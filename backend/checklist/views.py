from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import login, logout
from rest_framework.views import APIView
from .models import (
    Tip, Projekt, Segment, Vprasanje, SerijskaStevilka,
    Odgovor, Nastavitev, Profil, LogSprememb, ProjektTip
)
from .serializers import (
    TipSerializer, ProjektSerializer, SegmentSerializer, VprasanjeSerializer,
    SerijskaStevilkaSerializer, OdgovorSerializer, NastavitevSerializer,
    ProfilSerializer, LogSpremembSerializer, UserSerializer
)
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
import pandas as pd
import io
from django.http import HttpResponse
from django.db import transaction
import json
from django.utils import timezone
from django.db.models import Q
import openpyxl.styles
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
import os

# Registracija pisave DejaVu, ki podpira slovenske znake
FONT_PATH = os.path.join(os.path.dirname(__file__), 'fonts', 'DejaVuSans.ttf')
pdfmetrics.registerFont(TTFont('DejaVu', FONT_PATH))

# Create your views here.

class TipViewSet(viewsets.ModelViewSet):
    queryset = Tip.objects.all()
    serializer_class = TipSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['GET'], url_path='download-template')
    def download_template(self, request, pk=None):
        """Prenesi vzorčno XLSX datoteko za uvoz vprašanj."""
        # Ustvarimo vzorčne podatke
        data = {
            'segment': ['Pokrov igralnega mesta', 'Pokrov igralnega mesta', 'Maska sistema', 'Maska sistema'],
            'question': [
                'Ali je monitor brez poškodb?', 
                'Pravilno zapiranje nastavljen zaklep', 
                'BA ustnik pritjen',
                'Serijska številka (PT projekta)'
            ],
            'type': ['boolean', 'boolean', 'boolean', 'text'],
            'required': ['true', 'true', 'true', 'true'],
            'description': [
                'Preveri stanje monitorja', 
                'Preveri delovanje zaklepa', 
                'Preveri pritrditev ustnika',
                'Vnesi serijsko številko PT projekta'
            ],
            'options': ['', '', '', ''],
            'repeatable': ['true', 'true', 'false', 'false']  # Dodano polje za ponovljivost
        }
        
        # Ustvarimo DataFrame
        df = pd.DataFrame(data)
        
        # Ustvarimo Excel datoteko v pomnilniku
        excel_file = io.BytesIO()
        
        # Dodamo list z navodili
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Vzorec')
            
            # Dodamo list z navodili
            navodila = pd.DataFrame({
                'Polje': ['segment', 'question', 'type', 'required', 'description', 'options', 'repeatable'],
                'Opis': [
                    'Ime segmenta vprašanj',
                    'Besedilo vprašanja',
                    'Tip vprašanja (boolean, text, number, multiple_choice)',
                    'Ali je odgovor obvezen (true/false)',
                    'Dodatni opis vprašanja',
                    'Možni odgovori za multiple_choice tip (ločeni z vejico)',
                    'Ali se vprašanje lahko ponovi (true/false)'
                ],
                'Primer': [
                    'Pokrov igralnega mesta',
                    'Ali je monitor brez poškodb?',
                    'boolean',
                    'true',
                    'Preveri stanje monitorja',
                    'Da,Ne,n/a',
                    'true'
                ]
            })
            navodila.to_excel(writer, index=False, sheet_name='Navodila')
        
        # Pripravimo odgovor
        excel_file.seek(0)
        response = HttpResponse(
            excel_file.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=vzorec_vprasanj.xlsx'
        
        return response

    @action(detail=True, methods=['POST'], url_path='upload-xlsx')
    def upload_xlsx(self, request, pk=None):
        tip = self.get_object()
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'Datoteka ni bila posredovana'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        xlsx_file = request.FILES['file']
        if not xlsx_file.name.endswith('.xlsx'):
            return Response(
                {'error': 'Datoteka mora biti v formatu .xlsx'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Branje XLSX datoteke
            print(f"Berem datoteko: {xlsx_file.name}, velikost: {xlsx_file.size} bajtov")
            df = pd.read_excel(xlsx_file)
            print(f"Prebrane vrstice: {len(df)}")
            print(f"Stolpci: {list(df.columns)}")
            print(f"Tipi podatkov:\n{df.dtypes}")
            
            # Pretvorba NaN vrednosti v None in čiščenje podatkov
            df = df.replace({pd.NA: None})
            df = df.fillna('')  # Prazne vrednosti namesto NaN
            
            # Pretvorba boolean vrednosti
            if 'required' in df.columns:
                df['required'] = df['required'].map(lambda x: str(x).lower() == 'true')
            if 'repeatable' in df.columns:
                df['repeatable'] = df['repeatable'].map(lambda x: str(x).lower() == 'true')
            
            # Shranjevanje podatkov v bazo
            with transaction.atomic():
                # Izbrišemo obstoječe segmente za ta tip
                tip.tip_segmenti.all().delete()
                
                # Ustvarimo slovar za sledenje segmentom
                segmenti = {}
                
                # Iteriramo čez vsako vrstico
                for _, row in df.iterrows():
                    segment_naziv = row['segment']
                    
                    # Pridobimo ali ustvarimo segment
                    if segment_naziv not in segmenti:
                        segment = Segment.objects.create(
                            tip=tip,
                            naziv=segment_naziv
                        )
                        segmenti[segment_naziv] = segment
                    else:
                        segment = segmenti[segment_naziv]
                    
                    # Ustvarimo vprašanje
                    Vprasanje.objects.create(
                        segment=segment,
                        vprasanje=row['question'],
                        tip=row['type'],
                        repeatability=row['repeatable'] if 'repeatable' in row else False,
                        obvezno=row['required'],
                        opis=row['description'] if pd.notna(row['description']) else '',
                        moznosti=row['options'] if pd.notna(row['options']) else ''
                    )
            
            return Response({
                'sporočilo': 'Podatki uspešno uvoženi',
                'število_vrstic': len(df)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"Napaka pri branju datoteke: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {
                    'error': f'Napaka pri branju datoteke: {str(e)}',
                    'detail': traceback.format_exc()
                },
                status=status.HTTP_400_BAD_REQUEST
            )

class ProjektViewSet(viewsets.ModelViewSet):
    queryset = Projekt.objects.all()
    serializer_class = ProjektSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['GET'], url_path='export-archive')
    def export_archive(self, request, pk=None):
        """Izvozi celoten projekt v arhivski JSON format."""
        try:
            print(f"Začenjam izvoz projekta {pk}")
            projekt = self.get_object()
            print(f"Projekt najden: {projekt.id}")
            
            # Osnovni podatki o izvozu
            export_data = {
                "meta": {
                    "version": "1.0.0",
                    "export_date": timezone.now().isoformat(),
                    "application": "Kontrolni Seznam",
                },
                "projekt": {
                    "id": projekt.id,
                    "osebna_stevilka": projekt.osebna_stevilka,
                    "datum": projekt.datum.isoformat(),
                    "created_at": projekt.created_at.isoformat(),
                    "updated_at": projekt.updated_at.isoformat(),
                },
                "tipi": [],
                "segmenti": [],
                "serijske_stevilke": [],
                "odgovori": [],
                "spremembe": []
            }
            
            print("Dodajam podatke o tipih")
            # Dodaj podatke o tipih
            for projekt_tip in projekt.projekt_tipi.all():
                print(f"Obdelujem tip: {projekt_tip.tip.id}")
                tip_data = {
                    "id": projekt_tip.tip.id,
                    "naziv": projekt_tip.tip.naziv,
                    "stevilo_ponovitev": projekt_tip.stevilo_ponovitev,
                    "created_at": projekt_tip.created_at.isoformat(),
                }
                export_data["tipi"].append(tip_data)
                
                print(f"Dodajam segmente za tip {projekt_tip.tip.id}")
                # Dodaj segmente za ta tip
                for segment in Segment.objects.filter(tip=projekt_tip.tip):
                    print(f"Obdelujem segment: {segment.id}")
                    segment_data = {
                        "id": segment.id,
                        "naziv": segment.naziv,
                        "tip_id": segment.tip.id,
                        "vprasanja": []
                    }
                    
                    # Dodaj vprašanja za segment
                    for vprasanje in segment.vprasanja.all():
                        print(f"Obdelujem vprašanje: {vprasanje.id}")
                        vprasanje_data = {
                            "id": vprasanje.id,
                            "vprasanje": vprasanje.vprasanje,
                            "tip": vprasanje.tip,
                            "obvezno": vprasanje.obvezno,
                            "opis": vprasanje.opis,
                            "moznosti": vprasanje.moznosti,
                            "repeatability": vprasanje.repeatability
                        }
                        segment_data["vprasanja"].append(vprasanje_data)
                    
                    export_data["segmenti"].append(segment_data)
            
            print("Dodajam serijske številke")
            # Dodaj serijske številke
            for st in projekt.serijske_stevilke.all():
                print(f"Obdelujem serijsko številko: {st.id}")
                st_data = {
                    "id": st.id,
                    "stevilka": st.stevilka,
                    "tip_id": st.projekt_tip.tip.id,
                    "created_at": st.created_at.isoformat()
                }
                export_data["serijske_stevilke"].append(st_data)
                
                print(f"Dodajam odgovore za serijsko številko {st.id}")
                # Dodaj odgovore za to serijsko številko
                for odgovor in st.odgovori.all():
                    print(f"Obdelujem odgovor: {odgovor.id}")
                    odgovor_data = {
                        "id": odgovor.id,
                        "vprasanje_id": odgovor.vprasanje.id,
                        "serijska_stevilka_id": st.id,
                        "odgovor": odgovor.odgovor,
                        "created_at": odgovor.created_at.isoformat(),
                        "updated_at": odgovor.updated_at.isoformat()
                    }
                    
                    # Pridobi podatke o uporabniku iz LogSprememb
                    log = LogSprememb.objects.filter(
                        sprememba__contains=f"odgovor_{odgovor.id}"
                    ).order_by('-cas').first()
                    
                    if log:
                        odgovor_data["uporabnik"] = {
                            "osebna_stevilka": log.uporabnik.username,
                            "ime": log.uporabnik.first_name,
                            "priimek": log.uporabnik.last_name
                        }
                    
                    export_data["odgovori"].append(odgovor_data)
            
            print("Dodajam zgodovino sprememb")
            # Dodaj zgodovino sprememb
            for log in LogSprememb.objects.filter(
                Q(sprememba__contains=f"projekt_{projekt.id}") |
                Q(sprememba__contains=f"serijska_stevilka_{','.join(str(ss.id) for ss in projekt.serijske_stevilke.all())}")
            ):
                print(f"Obdelujem log: {log.id}")
                log_data = {
                    "id": log.id,
                    "cas": log.cas.isoformat(),
                    "sprememba": log.sprememba,
                    "stara_vrednost": log.stara_vrednost,
                    "nova_vrednost": log.nova_vrednost,
                    "uporabnik": log.uporabnik.username
                }
                export_data["spremembe"].append(log_data)
            
            print("Ustvarjam JSON response")
            # Ustvari JSON response
            response = HttpResponse(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                content_type='application/json'
            )
            
            # Generiraj ime datoteke
            filename = f"Projekt_{projekt.id}_arhiv_{timezone.now().strftime('%Y%m%d_%H%M%S')}.json"
            filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.'))
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            print("Izvoz uspešno zaključen")
            return response
            
        except Exception as e:
            print(f"Napaka pri izvozu: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['GET'], url_path='export-json')
    def export_json(self, request):
        """Izvozi vse projekte v JSON format."""
        try:
            projekti = self.get_queryset()
            serializer = self.get_serializer(projekti, many=True)
            
            # Ustvarimo JSON response
            response = HttpResponse(
                content_type='application/json',
            )
            response['Content-Disposition'] = 'attachment; filename=projekti.json'
            
            # Uporabimo json.dumps za pravilno formatiranje
            json.dump(serializer.data, response, indent=2, ensure_ascii=False)
            
            return response
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def create(self, request, *args, **kwargs):
        try:
            projekt_id = request.data.get('id')
            tip_id = request.data.get('tip')
            stevilo_ponovitev = request.data.get('stevilo_ponovitev', 1)

            # Preveri če projekt že obstaja
            projekt = Projekt.objects.filter(id=projekt_id).first()
            
            if projekt:
                # Projekt obstaja, dodaj nov tip
                if ProjektTip.objects.filter(projekt=projekt, tip_id=tip_id).exists():
                    return Response(
                        {'error': f'Projekt {projekt_id} že ima tip {tip_id}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Ustvari nov ProjektTip
                projekt_tip = ProjektTip.objects.create(
                    projekt=projekt,
                    tip_id=tip_id,
                    stevilo_ponovitev=stevilo_ponovitev
                )
                
                # Generiraj serijske številke
                for i in range(stevilo_ponovitev):
                    SerijskaStevilka.objects.create(
                        projekt=projekt,
                        projekt_tip=projekt_tip,
                        stevilka=f"{projekt_id}-{tip_id}-{i+1}"
                    )
                
                return Response(self.serializer_class(projekt).data)
            else:
                # Ustvari nov projekt
                with transaction.atomic():
                    projekt = Projekt.objects.create(
                        id=projekt_id,
                        osebna_stevilka=request.data.get('osebna_stevilka'),
                        datum=request.data.get('datum')
                    )
                    
                    # Ustvari ProjektTip
                    projekt_tip = ProjektTip.objects.create(
                        projekt=projekt,
                        tip_id=tip_id,
                        stevilo_ponovitev=stevilo_ponovitev
                    )
                    
                    # Generiraj serijske številke
                    for i in range(stevilo_ponovitev):
                        SerijskaStevilka.objects.create(
                            projekt=projekt,
                            projekt_tip=projekt_tip,
                            stevilka=f"{projekt_id}-{tip_id}-{i+1}"
                        )
                    
                    return Response(self.serializer_class(projekt).data)
                    
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def tipi(self, request, pk=None):
        """Vrni vse tipe za projekt"""
        projekt = self.get_object()
        tipi = projekt.projekt_tipi.all()
        return Response({
            'projekt_id': projekt.id,
            'tipi': [
                {
                    'tip_id': pt.tip.id,
                    'tip_naziv': pt.tip.naziv,
                    'stevilo_ponovitev': pt.stevilo_ponovitev,
                    'serijske_stevilke': [
                        ss.stevilka for ss in pt.serijske_stevilke.all()
                    ]
                } for pt in tipi
            ]
        })

    @action(detail=True, methods=['get'])
    def segmenti(self, request, pk=None):
        projekt = self.get_object()
        segmenti = projekt.segmenti.all()
        serializer = SegmentSerializer(segmenti, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['GET'], url_path='export-xlsx')
    def export_xlsx(self, request, pk=None):
        """Izvozi odgovore projekta v XLSX format."""
        try:
            # 1. Pridobi projekt in njegove podatke
            projekt = self.get_object()
            projekt_tip = projekt.projekt_tipi.first()
            if not projekt_tip:
                return Response({'error': 'Projekt nima določenega tipa'}, status=400)

            # 2. Pridobi serijske številke
            serijske_stevilke = SerijskaStevilka.objects.filter(projekt=projekt)
            if not serijske_stevilke.exists():
                return Response({'error': 'Projekt nima serijskih številk'}, status=400)

            # 3. Pridobi segmente
            segmenti = Segment.objects.filter(tip_id=projekt_tip.tip.id)
            if not segmenti.exists():
                return Response({'error': 'Ni najdenih segmentov za ta tip projekta'}, status=400)

            # 4. Ustvari Excel datoteko
            excel_file = io.BytesIO()
            writer = pd.ExcelWriter(excel_file, engine='openpyxl')

            # 5. Pripravi podatke za glavo
            header_data = [
                ['Kontrolni seznam', '', '', '', ''],
                ['', '', '', '', ''],
                ['Projekt', f"{projekt.id} - {projekt_tip.tip.naziv}", '', '', ''],
                ['Osebna številka', projekt.osebna_stevilka, '', 'Ime in priimek', ''],
                ['Datum', projekt.datum.strftime('%Y-%m-%d'), '', 'Podpis', ''],
                ['Število ponovitev', projekt_tip.stevilo_ponovitev, '', '', ''],
                ['', '', '', '', '']
            ]

            # 6. Pripravi podatke za vsako serijsko številko
            data = []
            
            # Za vsako serijsko številko
            for st in serijske_stevilke:
                # Dodaj serijsko številko kot naslov sekcije
                data.append(['', '', '', '', ''])
                data.append([f'Serijska številka: {st.stevilka}', '', '', '', ''])
                data.append(['Segment', 'Vprašanje', 'Odgovor', 'Datum odgovora', ''])

                # Za vsak segment
                for segment in segmenti:
                    current_segment = None
                    
                    # Za vsako vprašanje v segmentu
                    for vprasanje in Vprasanje.objects.filter(segment=segment):
                        odgovor = Odgovor.objects.filter(
                            vprasanje=vprasanje,
                            serijska_stevilka=st
                        ).first()

                        # Dodaj segment samo prvič ko se pojavi
                        segment_naziv = segment.naziv if current_segment != segment.naziv else ''
                        current_segment = segment.naziv

                        data.append([
                            segment_naziv,
                            vprasanje.vprasanje,
                            odgovor.odgovor if odgovor else '',
                            odgovor.created_at.strftime('%Y-%m-%d %H:%M:%S') if odgovor else '',
                            ''
                        ])

            # 7. Ustvari DataFrame in zapiši v Excel
            header_df = pd.DataFrame(header_data)
            data_df = pd.DataFrame(data)

            # Zapiši podatke v Excel
            header_df.to_excel(writer, sheet_name='Kontrolni seznam', index=False, header=False)
            data_df.to_excel(writer, sheet_name='Kontrolni seznam', startrow=len(header_data), index=False, header=False)

            # 8. Oblikovanje
            worksheet = writer.sheets['Kontrolni seznam']
            
            # Nastavi širino stolpcev
            worksheet.column_dimensions['A'].width = 25  # Segment
            worksheet.column_dimensions['B'].width = 40  # Vprašanje
            worksheet.column_dimensions['C'].width = 15  # Odgovor
            worksheet.column_dimensions['D'].width = 20  # Datum odgovora
            worksheet.column_dimensions['E'].width = 15  # Dodatni stolpec
            
            # Oblikuj naslov
            cell = worksheet['A1']
            cell.font = openpyxl.styles.Font(size=14, bold=True)
            
            # Oblikuj glavo
            for row in range(3, 7):
                for col in ['A', 'B', 'D']:
                    cell = worksheet[f'{col}{row}']
                    cell.font = openpyxl.styles.Font(bold=True)
            
            # Oblikuj sekcije serijskih številk
            row_num = len(header_data) + 1
            while row_num < worksheet.max_row:
                if worksheet[f'A{row_num}'].value and 'Serijska številka' in str(worksheet[f'A{row_num}'].value):
                    for col in ['A', 'B', 'C', 'D']:
                        cell = worksheet[f'{col}{row_num}']
                        cell.font = openpyxl.styles.Font(bold=True)
                        cell.fill = openpyxl.styles.PatternFill(start_color='E0E0E0', end_color='E0E0E0', fill_type='solid')
                row_num += 1

            # Shrani Excel
            writer.close()
            excel_file.seek(0)

            # 9. Pripravi response
            response = HttpResponse(
                excel_file.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )

            # Ustvari ime datoteke
            filename = f"projekt_{projekt.id}_odgovori.xlsx"
            filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.'))

            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            print(f"Napaka pri izvozu: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['POST'], url_path='import-json')
    def import_json(self, request):
        """Uvozi projekte iz JSON datoteke."""
        try:
            if 'file' not in request.FILES:
                return Response({'error': 'Ni datoteke'}, status=status.HTTP_400_BAD_REQUEST)

            file = request.FILES['file']
            data = json.load(file)

            print("Prejeti JSON podatki:")
            print(json.dumps(data, indent=2))

            with transaction.atomic():
                # Najprej preverimo, če projekt že obstaja
                if Projekt.objects.filter(id=data['projekt']['id']).exists():
                    return Response(
                        {'error': f'Projekt {data["projekt"]["id"]} že obstaja'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Ustvarimo projekt z originalnimi časovnimi žigi
                projekt = Projekt.objects.create(
                    id=data['projekt']['id'],
                    osebna_stevilka=data['projekt']['osebna_stevilka'],
                    datum=data['projekt']['datum'].split('T')[0],  # Vzamemo samo datum
                    created_at=data['projekt']['created_at'],
                    updated_at=data['projekt']['updated_at']
                )
                print(f"Ustvarjen projekt: {projekt.id}")

                # Slovar za sledenje serijskim številkam
                serijske_stevilke_map = {}

                # Dodamo tipe in serijske številke
                for tip_data in data['tipi']:
                    print(f"Dodajam tip: {tip_data}")
                    projekt_tip = ProjektTip.objects.create(
                        projekt=projekt,
                        tip_id=tip_data['id'],
                        stevilo_ponovitev=tip_data['stevilo_ponovitev'],
                        created_at=tip_data['created_at']
                    )

                    # Dodamo serijske številke za ta tip
                    for st_data in [s for s in data['serijske_stevilke'] if s['tip_id'] == tip_data['id']]:
                        print(f"Dodajam serijsko številko: {st_data}")
                        serijska = SerijskaStevilka.objects.create(
                            projekt=projekt,
                            projekt_tip=projekt_tip,
                            stevilka=st_data['stevilka'],
                            created_at=st_data['created_at']
                        )
                        # Shranimo preslikavo ID-jev
                        serijske_stevilke_map[st_data['id']] = serijska

                # Dodamo odgovore
                for odgovor_data in data['odgovori']:
                    print(f"Dodajam odgovor: {odgovor_data}")
                    try:
                        # Poiščemo serijsko številko iz preslikave
                        serijska = serijske_stevilke_map[odgovor_data['serijska_stevilka_id']]
                        
                        Odgovor.objects.create(
                            vprasanje_id=odgovor_data['vprasanje_id'],
                            odgovor=odgovor_data['odgovor'],
                            serijska_stevilka=serijska,
                            created_at=odgovor_data['created_at'],
                            updated_at=odgovor_data['updated_at']
                        )
                    except Exception as e:
                        print(f"Napaka pri ustvarjanju odgovora: {str(e)}")
                        raise

                # Dodamo zapis v LogSprememb o uvozu
                LogSprememb.objects.create(
                    uporabnik=request.user,
                    sprememba=f"projekt_{projekt.id}_uvoz",
                    stara_vrednost="",
                    nova_vrednost=f"Uvoženo iz arhiva {timezone.now().isoformat()}"
                )

            return Response({'message': 'Projekt uspešno uvožen'}, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"Napaka pri uvozu: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['GET'], url_path='export-pdf')
    def export_pdf(self, request, pk=None):
        """Izvozi odgovore projekta v PDF format."""
        try:
            # 1. Pridobi projekt in njegove podatke
            projekt = self.get_object()
            projekt_tip = projekt.projekt_tipi.first()
            if not projekt_tip:
                return Response({'error': 'Projekt nima določenega tipa'}, status=400)

            # 2. Pridobi serijske številke
            serijske_stevilke = SerijskaStevilka.objects.filter(projekt=projekt)
            if not serijske_stevilke.exists():
                return Response({'error': 'Projekt nima serijskih številk'}, status=400)

            # 3. Pridobi segmente
            segmenti = Segment.objects.filter(tip_id=projekt_tip.tip.id)
            if not segmenti.exists():
                return Response({'error': 'Ni najdenih segmentov za ta tip projekta'}, status=400)

            # 4. Pripravi PDF
            response = HttpResponse(content_type='application/pdf')
            filename = f"projekt_{projekt.id}_odgovori.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            # Ustvari PDF dokument
            doc = SimpleDocTemplate(
                response,
                pagesize=A4,
                rightMargin=30,
                leftMargin=30,
                topMargin=30,
                bottomMargin=30
            )

            # Pripravi stile
            styles = getSampleStyleSheet()
            styles.add(ParagraphStyle(
                name='NaslovSlovenski',
                fontName='DejaVu',
                fontSize=16,
                spaceAfter=20,
                alignment=1,  # Center
                leading=20
            ))
            styles.add(ParagraphStyle(
                name='PodnaslovSlovenski',
                fontName='DejaVu',
                fontSize=12,
                spaceAfter=10,
                alignment=1,  # Center
                leading=16
            ))
            styles.add(ParagraphStyle(
                name='NormalSlovenski',
                fontName='DejaVu',
                fontSize=10,
                spaceAfter=5,
                leading=14
            ))
            styles.add(ParagraphStyle(
                name='TabelaGlava',
                fontName='DejaVu',
                fontSize=9,
                textColor=colors.white,
                alignment=1,  # Center
                leading=12
            ))
            styles.add(ParagraphStyle(
                name='TabelaVsebina',
                fontName='DejaVu',
                fontSize=9,
                alignment=0,  # Left
                leading=12
            ))

            # Seznam elementov za PDF
            elements = []

            # Dodaj naslov in podatke o projektu
            elements.append(Paragraph('Kontrolni seznam', styles['NaslovSlovenski']))
            elements.append(Paragraph(f'Projekt: {projekt.id} - {projekt_tip.tip.naziv}', styles['PodnaslovSlovenski']))
            
            # Podatki o projektu v tabeli
            podatki_projekta = [
                ['Osebna številka:', projekt.osebna_stevilka, 'Datum:', projekt.datum.strftime("%d.%m.%Y")],
                ['Število ponovitev:', str(projekt_tip.stevilo_ponovitev), 'Ime in priimek:', '_' * 20],
                ['', '', 'Podpis:', '_' * 20]
            ]
            
            t_podatki = Table(podatki_projekta, colWidths=[100, 150, 100, 150])
            t_podatki.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), 'DejaVu'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(t_podatki)
            elements.append(Spacer(1, 20))

            # Za vsako serijsko številko
            for st in serijske_stevilke:
                elements.append(Paragraph(f'Serijska številka: {st.stevilka}', styles['PodnaslovSlovenski']))
                
                # Za vsak segment
                for segment in segmenti:
                    vprasanja = Vprasanje.objects.filter(segment=segment)
                    if not vprasanja.exists():
                        continue

                    # Podatki za tabelo
                    table_data = [[
                        Paragraph('Segment', styles['TabelaGlava']),
                        Paragraph('Vprašanje', styles['TabelaGlava']),
                        Paragraph('Odgovor', styles['TabelaGlava']),
                        Paragraph('Datum odgovora', styles['TabelaGlava'])
                    ]]
                    
                    current_segment = None
                    for vprasanje in vprasanja:
                        odgovor = Odgovor.objects.filter(
                            vprasanje=vprasanje,
                            serijska_stevilka=st
                        ).first()

                        # Dodaj segment samo prvič ko se pojavi
                        segment_naziv = segment.naziv if current_segment != segment.naziv else ''
                        current_segment = segment.naziv

                        table_data.append([
                            Paragraph(segment_naziv, styles['TabelaVsebina']),
                            Paragraph(vprasanje.vprasanje, styles['TabelaVsebina']),
                            Paragraph(odgovor.odgovor if odgovor else '', styles['TabelaVsebina']),
                            Paragraph(odgovor.created_at.strftime('%d.%m.%Y %H:%M') if odgovor else '', styles['TabelaVsebina'])
                        ])

                    # Ustvari tabelo
                    if len(table_data) > 1:  # Če imamo podatke poleg glave
                        t = Table(table_data, colWidths=[100, 220, 80, 100])
                        t.setStyle(TableStyle([
                            ('FONT', (0, 0), (-1, -1), 'DejaVu'),
                            ('FONTSIZE', (0, 0), (-1, -1), 9),
                            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                            ('BOX', (0, 0), (-1, -1), 1, colors.black),
                            ('TOPPADDING', (0, 0), (-1, -1), 5),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 5),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                        ]))
                        elements.append(t)
                        elements.append(Spacer(1, 15))

                elements.append(Spacer(1, 20))

            # Generiraj PDF
            doc.build(elements)
            return response

        except Exception as e:
            print(f"Napaka pri izvozu PDF: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=500)

class SegmentViewSet(viewsets.ModelViewSet):
    queryset = Segment.objects.all()
    serializer_class = SegmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Segment.objects.all()
        tip_id = self.request.query_params.get('tip_id', None)
        projekt_id = self.request.query_params.get('projekt_id', None)
        
        if projekt_id is not None:
            # Najprej poiščemo tip projekta
            projekt_tip = ProjektTip.objects.filter(
                projekt_id=projekt_id
            ).first()
            
            if projekt_tip:
                # Filtriramo segmente samo za ta tip
                queryset = queryset.filter(tip_id=projekt_tip.tip_id)
        elif tip_id is not None:
            # Če nimamo projekt_id, filtriramo samo po tip_id
            queryset = queryset.filter(tip_id=tip_id)
        
        return queryset

    @action(detail=True, methods=['get'])
    def vprasanja(self, request, pk=None):
        """Vrni vprašanja za segment."""
        segment = self.get_object()
        vprasanja = Vprasanje.objects.filter(segment=segment)
        serializer = VprasanjeSerializer(vprasanja, many=True)
        return Response(serializer.data)

class VprasanjeViewSet(viewsets.ModelViewSet):
    queryset = Vprasanje.objects.all()
    serializer_class = VprasanjeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Vprasanje.objects.all()
        tip_id = self.request.query_params.get('tip_id', None)
        projekt_id = self.request.query_params.get('projekt_id', None)
        
        if tip_id is not None:
            queryset = queryset.filter(segment__tip_id=tip_id)
            
        if projekt_id is not None:
            # Pridobi tip projekta
            projekt_tip = ProjektTip.objects.filter(
                projekt_id=projekt_id,
                tip_id=tip_id
            ).first()
            
            if projekt_tip:
                queryset = queryset.filter(segment__tip_id=projekt_tip.tip_id)
        
        return queryset

    @action(detail=True, methods=['get'])
    def odgovori(self, request, pk=None):
        vprasanje = self.get_object()
        tip_id = self.request.query_params.get('tip_id', None)
        projekt_id = self.request.query_params.get('projekt_id', None)
        
        odgovori = vprasanje.odgovori.all()
        
        if projekt_id is not None:
            odgovori = odgovori.filter(
                serijska_stevilka__projekt_id=projekt_id
            )
            
        if tip_id is not None:
            odgovori = odgovori.filter(
                serijska_stevilka__projekt_tip__tip_id=tip_id
            )
            
        serializer = OdgovorSerializer(odgovori, many=True)
        return Response(serializer.data)

class SerijskaStevilkaViewSet(viewsets.ModelViewSet):
    queryset = SerijskaStevilka.objects.all()
    serializer_class = SerijskaStevilkaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SerijskaStevilka.objects.all()
        projekt_id = self.request.query_params.get('projekt', None)
        tip_id = self.request.query_params.get('tip_id', None)
        
        if projekt_id is not None:
            queryset = queryset.filter(projekt_id=projekt_id)
            
            if tip_id is not None:
                queryset = queryset.filter(projekt_tip__tip_id=tip_id)
            else:
                # Če tip_id ni podan, vzamemo tip iz ProjektTip
                projekt_tip = ProjektTip.objects.filter(projekt_id=projekt_id).first()
                if projekt_tip:
                    queryset = queryset.filter(projekt_tip__tip_id=projekt_tip.tip_id)
        
        return queryset.order_by('id')

    @action(detail=True, methods=['get'])
    def odgovori(self, request, pk=None):
        serijska_stevilka = self.get_object()
        odgovori = serijska_stevilka.odgovori.all()
        serializer = OdgovorSerializer(odgovori, many=True)
        return Response(serializer.data)

class OdgovorViewSet(viewsets.ModelViewSet):
    queryset = Odgovor.objects.all()
    serializer_class = OdgovorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Odgovor.objects.all()
        serijska_stevilka_id = self.request.query_params.get('serijska_stevilka', None)
        
        if serijska_stevilka_id is not None:
            # Pridobi serijsko številko
            serijska_stevilka = SerijskaStevilka.objects.filter(id=serijska_stevilka_id).first()
            if serijska_stevilka:
                # Filtriraj odgovore po serijski številki in vprašanjih za ta tip projekta
                queryset = queryset.filter(
                    serijska_stevilka=serijska_stevilka,
                    vprasanje__segment__tip=serijska_stevilka.projekt_tip.tip
                )
        
        return queryset

    @action(detail=False, methods=['POST'], url_path='batch')
    def batch_create(self, request):
        try:
            odgovori = request.data
            serializer = self.get_serializer(data=odgovori, many=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class NastavitevViewSet(viewsets.ModelViewSet):
    queryset = Nastavitev.objects.all()
    serializer_class = NastavitevSerializer
    permission_classes = [permissions.IsAuthenticated]

class ProfilViewSet(viewsets.ModelViewSet):
    queryset = Profil.objects.all()
    serializer_class = ProfilSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Ustvarimo privzeti profil, če še ne obstaja
        if not Profil.objects.exists():
            Profil.objects.create(
                naziv='Privzeti profil',
                nastavitve={
                    'tema': 'svetla',
                    'jezik': 'sl',
                    'notifikacije': True,
                    'avtomatska_odjava': False
                }
            )
        return Profil.objects.all()

class LogSpremembViewSet(viewsets.ModelViewSet):
    queryset = LogSprememb.objects.all()
    serializer_class = LogSpremembSerializer
    permission_classes = [permissions.IsAuthenticated]

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        osebna_stevilka = request.data.get('osebna_stevilka')
        password = request.data.get('password')
        try:
            user = User.objects.get(username=osebna_stevilka)
            if user.check_password(password):
                login(request, user)
                return Response({'status': 'success'})
            return Response({'status': 'error', 'message': 'Neveljavno geslo'}, status=status.HTTP_401_UNAUTHORIZED)
        except User.DoesNotExist:
            return Response({'status': 'error', 'message': 'Osebna številka ne obstaja'}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            logout(request)
            return Response({'message': 'Uspešno odjavljen'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        osebna_stevilka = request.data.get('osebna_stevilka')
        password = request.data.get('password')
        email = request.data.get('email')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')

        if not all([osebna_stevilka, password, email, first_name, last_name]):
            return Response(
                {'error': 'Vsa polja so obvezna'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=osebna_stevilka).exists():
            return Response(
                {'error': 'Osebna številka že obstaja'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=osebna_stevilka,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name
        )

        login(request, user)
        return Response(
            {'message': 'Uporabnik uspešno registriran'},
            status=status.HTTP_201_CREATED
        )

@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})

class UserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'osebna_stevilka': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser
        })

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return User.objects.all().order_by('username')

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {'error': 'Staro in novo geslo sta obvezna'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(old_password):
            return Response(
                {'error': 'Napačno staro geslo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.set_password(new_password)
        request.user.save()
        return Response(
            {'message': 'Geslo uspešno spremenjeno'},
            status=status.HTTP_200_OK
        )
