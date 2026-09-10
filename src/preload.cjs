const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  getState: () => ipcRenderer.invoke("overlay:get-state"),
  refresh: () => ipcRenderer.invoke("overlay:refresh"),
  openDashboard: () => ipcRenderer.invoke("overlay:open-dashboard"),
  quit: () => ipcRenderer.invoke("overlay:quit"),
  onState: (handler) => {
    const listener = (_event, state) => {
      handler(state);
    };
    ipcRenderer.on("overlay:state", listener);
    return () => {
      ipcRenderer.removeListener("overlay:state", listener);
    };
  },
});
