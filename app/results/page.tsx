"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, AlertTriangle, Loader2, Eye, Download, RotateCcw, Clock, Maximize2 } from "lucide-react"
// Heatmap implementation using canvas for better performance and visual quality

interface GazePoint {
  x: number
  y: number
  timestamp: number
  scrollY: number
}

interface AnalysisData {
  url: string
  timestamp: string
  duration: number
  gazeData: GazePoint[]
  pageHeight: number
  pageWidth: number
  viewportHeight: number
  viewportWidth: number
  scrollData: any[]
  clicks: any[]
  screenshot?: string
  analysis: {
    heatmap: {
      hotSpots: {
        x: number
        y: number
        intensity: number
      }[]
    }
  }
}

interface ViewportSize {
  width: number
  height: number
}

interface HeatmapDataPoint {
  x: number;
  y: number;
  value: number;
}

interface HeatmapStats {
  totalPoints: number;
  totalTime: number;
  frequency: number;
  avgPosition: { x: number; y: number };
  maxScroll: number;
}

// Function to draw the website screenshot as background
const drawScreenshotBackground = (
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D, 
  image: HTMLImageElement
): void => {
  if (!image.complete) return;
  
  // Calculate aspect ratio to maintain proportions
  const imageAspect = image.width / image.height;
  const canvasAspect = canvas.width / canvas.height;
  
  let renderWidth = canvas.width;
  let renderHeight = canvas.height;
  let offsetX = 0;
  let offsetY = 0;
  
  // Fit the image to canvas while maintaining aspect ratio
  if (imageAspect > canvasAspect) {
    // Image is wider than canvas
    renderHeight = canvas.width / imageAspect;
    offsetY = (canvas.height - renderHeight) / 2;
  } else {
    // Image is taller than canvas
    renderWidth = canvas.height * imageAspect;
    offsetX = (canvas.width - renderWidth) / 2;
  }
  
  // Clear and draw the image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, renderWidth, renderHeight);
};

// Heatmap implementation using canvas
const drawHeatmap = (
  canvas: HTMLCanvasElement, 
  points: {x: number, y: number}[], 
  width: number, 
  height: number,
  radius: number = 50,
  blur: number = 15
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Create a temporary canvas for the heatmap
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = width;
  heatmapCanvas.height = height;
  const heatmapCtx = heatmapCanvas.getContext('2d');
  if (!heatmapCtx) return;

  // Draw points with radial gradients
  points.forEach(point => {
    const x = point.x;
    const y = point.y;
    
    // Create gradient
    const gradient = heatmapCtx.createRadialGradient(
      x, y, 0,
      x, y, radius
    );
    
    // Color stops for the gradient (red to yellow to blue)
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 255, 0.1)');
    
    // Draw the gradient
    heatmapCtx.beginPath();
    heatmapCtx.arc(x, y, radius, 0, Math.PI * 2);
    heatmapCtx.fillStyle = gradient;
    heatmapCtx.fill();
  });
  
  // Apply blur effect
  if (blur > 0) {
    ctx.filter = `blur(${blur}px)`;
  }
  
  // Draw the heatmap onto the main canvas
  ctx.drawImage(heatmapCanvas, 0, 0);
  
  // Reset filter
  ctx.filter = 'none';
  
  // Apply color mapping (heat colors)
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Convert to grayscale to get intensity
    const intensity = (r + g + b) / 3;
    
    if (intensity > 0) {
      // Map intensity to heat colors
      // Red (high intensity) -> Yellow -> Green -> Blue (low intensity)
      if (intensity > 200) {
        // Red to Yellow
        const t = (intensity - 200) / 55;
        data[i] = 255;
        data[i + 1] = Math.floor(255 * t);
        data[i + 2] = 0;
      } else if (intensity > 100) {
        // Yellow to Green
        const t = (intensity - 100) / 100;
        data[i] = Math.floor(255 * (1 - t));
        data[i + 1] = 255;
        data[i + 2] = 0;
      } else {
        // Green to Blue
        const t = intensity / 100;
        data[i] = 0;
        data[i + 1] = Math.floor(255 * t);
        data[i + 2] = Math.floor(255 * (1 - t));
      }
      
      // Adjust alpha based on intensity
      data[i + 3] = Math.min(255, intensity * 1.5);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
};

export default function ResultsPage() {
  // State for analysis data and loading states
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [heatmapGenerated, setHeatmapGenerated] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [scrollY, setScrollY] = useState(0);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Get heatmap statistics
  const getHeatmapStats = useCallback((): { min: number; max: number; avg: number } => {
    if (!analysisData?.gazeData?.length) return { min: 0, max: 0, avg: 0 };

    // Count occurrences of each point to estimate intensity
    const pointCounts: { [key: string]: number } = {};
    
    analysisData.gazeData.forEach((point: GazePoint) => {
      const key = `${Math.round(point.x)},${Math.round(point.y)}`;
      pointCounts[key] = (pointCounts[key] || 0) + 1;
    });

    const values = Object.values(pointCounts);
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    return { min, max, avg };
  }, [analysisData?.gazeData]);
  
  // Calculate analysis stats
  const analysisStats = useMemo(() => {
    if (!analysisData) {
      return {
        totalPoints: 0,
        totalTime: 0,
        frequency: 0,
        maxScroll: 0
      };
    }
    
    const totalPoints = analysisData.gazeData.length;
    const totalTime = analysisData.duration / 1000; // Convert to seconds
    const frequency = totalTime > 0 ? totalPoints / totalTime : 0;
    
    let maxScroll = 0;
    analysisData.gazeData.forEach(point => {
      maxScroll = Math.max(maxScroll, point.scrollY || 0);
    });
    
    return {
      totalPoints,
      totalTime,
      frequency: Number(frequency.toFixed(2)),
      maxScroll
    };
  }, [analysisData]);
  
  // Get heatmap stats
  const heatmapStats = getHeatmapStats();
    
  // Load analysis data and fetch screenshot
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get URL from query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const websiteUrl = searchParams.get('url');
        
        if (!websiteUrl) {
          setError("URL веб-сайта не указан");
          setIsLoading(false);
          return;
        }
        
        // Load analysis data from localStorage
        const savedData = localStorage.getItem('gazeAnalysisData');
        if (!savedData) {
          setError("Данные анализа не найдены");
          setIsLoading(false);
          return;
        }
        
        const analysisData = JSON.parse(savedData);
        
        // Create analysis data object
        const data: AnalysisData = {
          url: websiteUrl,
          timestamp: new Date(analysisData.timestamp).toISOString(),
          duration: analysisData.analysisTime * 1000, // Convert to ms
          gazeData: analysisData.gazeData,
          pageHeight: analysisData.pageHeight,
          pageWidth: analysisData.viewportWidth,
          viewportHeight: analysisData.viewportHeight,
          viewportWidth: analysisData.viewportWidth,
          scrollData: [],
          clicks: [],
          analysis: {
            heatmap: {
              hotSpots: []
            }
          }
        };
        
        setAnalysisData(data);
        
        // Set viewport size
        setViewportSize({
          width: analysisData.viewportWidth,
          height: analysisData.viewportHeight
        });
        
        // Set page height
        setPageHeight(analysisData.pageHeight);
        
        // Fetch fresh screenshot from the server
        const screenshotUrl = `/api/proxy?url=${encodeURIComponent(websiteUrl)}`;
        setScreenshotUrl(screenshotUrl);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Ошибка загрузки данных анализа');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    // Cleanup
    return () => {
      // Cleanup if needed
    };
  }, [])

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>): void => {
    if (containerRef.current) {
      const scrollY = containerRef.current.scrollTop
      setScrollPosition(scrollY)
    }
  }, [])

  // Handle image load
  const handleImageLoad = useCallback((): void => {
    if (imageRef.current) {
      setViewportSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  }, [])

  // Generate heatmap on top of the website screenshot
  const generateHeatmap = useCallback((): void => {
    if (!analysisData || !canvasRef.current || !imageRef.current) {
      console.error('Missing required refs or data');
      return;
    }
    
    setError(null);
    setIsGenerating(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error("Не удалось получить контекст canvas");
      }

      // Set canvas size to match the screenshot
      const width = imageRef.current.naturalWidth || window.innerWidth;
      const height = imageRef.current.naturalHeight || window.innerHeight * 2;
      
      canvas.width = width;
      canvas.height = height;

      // Draw the screenshot as background
      drawScreenshotBackground(canvas, ctx, imageRef.current);
      
      // Create a temporary canvas for the heatmap
      const heatmapCanvas = document.createElement('canvas');
      heatmapCanvas.width = width;
      heatmapCanvas.height = height;
      const heatmapCtx = heatmapCanvas.getContext('2d');
      
      if (!heatmapCtx) {
        throw new Error("Не удалось создать контекст для тепловой карты");
      }
      
      // Initialize heatmap with transparent background
      heatmapCtx.clearRect(0, 0, width, height);

      // Create image data for the heatmap
      const heatmapData = heatmapCtx.createImageData(width, height);
      const data = heatmapData.data;

      // Initialize with transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;        // Red
        data[i + 1] = 0;    // Green
        data[i + 2] = 0;    // Blue
        data[i + 3] = 0;    // Alpha
      }


      // Create heat map from gaze data, accounting for scroll position
      analysisData.gazeData.forEach((point: GazePoint) => {
        const radius = 40;
        const intensity = 0.4;

        // Scale points to match canvas size
        const scaleX = canvas.width / window.innerWidth;
        const scaleY = canvas.height / (analysisData.pageHeight || window.innerHeight * 2);
        
        const x = Math.round(point.x * scaleX);
        const y = Math.round((point.y + (point.scrollY || 0)) * scaleY);

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= radius) {
              const px = x + dx;
              const py = y + dy;

              if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                const pixelIndex = (py * canvas.width + px) * 4;
                const alpha = intensity * (1 - distance / radius);

                // Accumulate heat values
                const currentAlpha = data[pixelIndex + 3] / 255;
                const newAlpha = Math.min(currentAlpha + alpha, 1);

                // Create heat gradient (blue -> green -> yellow -> red)
                if (newAlpha < 0.25) {
                  data[pixelIndex] = 0;
                  data[pixelIndex + 1] = 0;
                  data[pixelIndex + 2] = 255;
                } else if (newAlpha < 0.5) {
                  data[pixelIndex] = 0;
                  data[pixelIndex + 1] = 255;
                  data[pixelIndex + 2] = 0;
                } else if (newAlpha < 0.75) {
                  data[pixelIndex] = 255;
                  data[pixelIndex + 1] = 255;
                  data[pixelIndex + 2] = 0;
                } else {
                  data[pixelIndex] = 255;
                  data[pixelIndex + 1] = 0;
                  data[pixelIndex + 2] = 0;
                }

                data[pixelIndex + 3] = Math.min(newAlpha * 255, 255);
              }
            }
          }
        }
      });

      // Apply the heatmap data to the temporary canvas
      heatmapCtx.putImageData(heatmapData, 0, 0);

      // Composite the heatmap over the screenshot
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(heatmapCanvas, 0, 0);
      
      // Reset composite settings
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      
      setHeatmapGenerated(true);
    } catch (error) {
      console.error('Error generating heatmap:', error);
      setError('Ошибка при генерации тепловой карты');
    } finally {
      setIsGenerating(false);
    }
  }, [analysisData, screenshotUrl, viewportSize, scrollPosition]);

  // Handle scroll events to update heatmap and track position
  useEffect(() => {
    if (!heatmapGenerated) return;
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setScrollY(scrollPosition);
      // Re-render heatmap on scroll
      generateHeatmap();
    };
    
    // Initial scroll position
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [heatmapGenerated, generateHeatmap]);

  // Download PNG of the heatmap
  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return
    
    try {
      const link = document.createElement('a')
      link.download = 'heatmap.png'
      link.href = canvasRef.current.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Error downloading PNG:', error)
      setError('Ошибка при сохранении PNG')
    }
  }, [])

  // Download PDF of the heatmap
  const downloadPdf = useCallback(async () => {
    if (!canvasRef.current) return
    
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: viewportSize.width > viewportSize.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [viewportSize.width, viewportSize.height]
      })
      
      const imgData = canvasRef.current.toDataURL('image/jpeg', 0.9)
      pdf.addImage(imgData, 'JPEG', 0, 0, viewportSize.width, viewportSize.height)
      pdf.save('heatmap.pdf')
    } catch (error) {
      console.error('Error generating PDF:', error)
      setError('Ошибка при создании PDF')
    }
  }, [viewportSize])

  // Reset heatmap
  const resetHeatmap = useCallback((): void => {
    setHeatmapGenerated(false)
    // Reset canvas when clearing heatmap
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Redraw the background
        if (analysisData) {
          // Use a simple background if no screenshot is available
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some placeholder text
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Скриншот не доступен', canvas.width / 2, canvas.height / 2);
        ctx.fillText(analysisData.url, canvas.width / 2, canvas.height / 2 + 30);
        }
      }
    }
  }, [analysisData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg text-gray-600">Загрузка результатов анализа...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="text-red-600">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Ошибка</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
            <Button 
              className="mt-4" 
              variant="outline" 
              onClick={() => window.location.href = '/'}
            >
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg">Загрузка данных анализа...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Данные не найдены</CardTitle>
            <CardDescription>
              Не удалось загрузить данные анализа. Пожалуйста, попробуйте снова.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Обновить страницу
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="space-y-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Результаты анализа</CardTitle>
            <CardDescription>
              Анализ страницы: {analysisData?.url || 'Неизвестный URL'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Всего точек</span>
                </div>
                <p className="text-2xl font-bold">{analysisStats.totalPoints.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Время анализа</span>
                </div>
                <p className="text-2xl font-bold">{analysisStats.totalTime.toFixed(1)} сек</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">Частота взгляда</span>
                </div>
                <p className="text-2xl font-bold">{analysisStats.frequency}/сек</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Maximize2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Макс. прокрутка</span>
                </div>
                <p className="text-2xl font-bold">{Math.round(analysisStats.maxScroll)}px</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button 
                onClick={generateHeatmap} 
                disabled={isGenerating || heatmapGenerated}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    {heatmapGenerated ? 'Тепловая карта сгенерирована' : 'Сгенерировать тепловую карту'}
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={resetHeatmap}
                disabled={!heatmapGenerated}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Сбросить
              </Button>
              
              <Button 
                variant="outline" 
                onClick={downloadPng}
                disabled={!heatmapGenerated}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Скачать PNG
              </Button>
              
              <Button 
                variant="outline" 
                onClick={downloadPdf}
                disabled={!heatmapGenerated}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Скачать PDF
              </Button>
            </div>

            <div className="flex-1 overflow-auto relative" ref={containerRef} onScroll={handleScroll}>
              <div 
                className="relative mx-auto" 
                style={{
                  width: viewportSize.width,
                  height: viewportSize.height,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {screenshotUrl && (
                  <>
                    <img
                      ref={imageRef}
                      src={screenshotUrl}
                      alt="Screenshot of analyzed page"
                      className="block w-full h-auto"
                      onLoad={handleImageLoad}
                    />
                    <canvas
                      ref={canvasRef}
                      className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-300 ${
                        heatmapGenerated ? 'opacity-80' : 'opacity-0'
                      }`}
                      style={{
                        mixBlendMode: 'multiply',
                        pointerEvents: 'none'
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
