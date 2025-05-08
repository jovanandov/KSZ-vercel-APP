//const { app, BrowserWindow } = require('electron');
//const path = require('path');
//const isDev = require('electron-is-dev');

//function createWindow() {
  //const mainWindow = new BrowserWindow({
    //width: 1200,
    //height: 800,
    //webPreferences: {
      //nodeIntegration: true,
      //contextIsolation: false,
      //webSecurity: false
    }
  });

  // Poskusimo najprej na portu 5174, ker je 5173 zaseden
  //const devServerUrl = 'http://localhost:5174';
  
  //if (isDev) {
    //mainWindow.loadURL(devServerUrl);
    //mainWindow.webContents.openDevTools();
  } //else {
    //mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

//app.whenReady().then(createWindow);

//app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') {
    //app.quit();
  }
});

//app.on('activate', () => {
  //if (BrowserWindow.getAllWindows().length === 0) {
    //createWindow();
  }
}); 
