declare global {
  interface Window {
    webgazer: {
      setGazeListener: (callback: (data: any, elapsedTime: number) => void) => any
      begin: () => any
      end: () => void
      recordScreenPosition: (x: number, y: number, type: string) => void
    }
  }
}

export {}
