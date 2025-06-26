"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, AlertTriangle, Loader2, Eye, Download, RotateCcw } from "lucide-react"

interface GazePoint {
  x: number
  y: number
  timestamp: number
  scrollY: number
}

interface AnalysisData {
  url: string
  gazeData: GazePoint[]
  analysisTime: number
  timestamp: number
  pageHeight: number
  screenshotData?: string
}

interface ViewportSize {
  width: number
  height: number
}

interface HeatmapStats {
  totalPoints: number
  totalTime: number
  frequency: number
  avgPosition: { x: number; y: number }
  maxScroll: number
}

export default function ResultsPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [heatmapGenerated, setHeatmapGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string>("")
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 })
  const [scrollPosition, setScrollPosition] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Generate heatmap statistics
  const getHeatmapStats = useCallback((): HeatmapStats => {
    if (!analysisData) {
      return {
        totalPoints: 0,
        totalTime: 0,
        frequency: 0,
        avgPosition: { x: 0, y: 0 },
        maxScroll: 0
      }
    }

    const { gazeData, analysisTime } = analysisData
    const totalPoints = gazeData.length
    const totalTime = Math.round(analysisTime / 1000)
    const frequency = totalPoints > 0 ? parseFloat((totalPoints / analysisTime * 1000).toFixed(2)) : 0
    
    // Calculate average position
    let sumX = 0
    let sumY = 0
    let maxScroll = 0
    
    gazeData.forEach(point => {
      sumX += point.x
      sumY += point.y
      maxScroll = Math.max(maxScroll, point.scrollY || 0)
    })
    
    const avgX = totalPoints > 0 ? Math.round(sumX / totalPoints) : 0
    const avgY = totalPoints > 0 ? Math.round(sumY / totalPoints) : 0
    
    return {
      totalPoints,
      totalTime,
      frequency,
      avgPosition: { x: avgX, y: avgY },
      maxScroll
    }
  }, [analysisData])

  // Load analysis data and take screenshot
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = localStorage.getItem("gazeAnalysisData")
        if (savedData) {
          const data: AnalysisData = JSON.parse(savedData)
          setAnalysisData(data)
          
          // Take screenshot of the analyzed URL
          if (data.url) {
            try {
              const width = Math.min(window.innerWidth, 1920) // Limit max width
              const response = await fetch(`/api/proxy?url=${encodeURIComponent(data.url)}&width=${width}`)
              
              if (!response.ok) {
                throw new Error(`Failed to capture screenshot: ${response.status}`)
              }
              
              const blob = await response.blob()
              const url = URL.createObjectURL(blob)
              setScreenshotUrl(url)
              
              // Get page height from response headers
              const pageHeight = parseInt(response.headers.get('X-Page-Height') || '0')
              setPageHeight(pageHeight)
              
              // Set viewport size
              setViewportSize({
                width,
                height: Math.min(pageHeight, 10000) // Limit height for rendering
              })
              
            } catch (error) {
              console.error('Error capturing screenshot:', error)
              setError('Не удалось загрузить скриншот страницы')
            }
          }
        } else {
          setError("Данные анализа не найдены")
        }
      } catch (error) {
        console.error("Error loading analysis data:", error)
        setError("Ошибка загрузки данных анализа")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
    
    // Cleanup
    return () => {
      if (screenshotUrl) {
        URL.revokeObjectURL(screenshotUrl)
      }
    }
  }, [screenshotUrl])

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const scrollY = containerRef.current.scrollTop
      setScrollPosition(scrollY)
    }
  }, [])

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setViewportSize(prev => ({
        ...prev,
        height: Math.min(imageRef.current?.naturalHeight || 0, 10000)
      }))
    }
  }, [])

  // Generate heatmap
  const generateHeatmap = useCallback(() => {
    if (!canvasRef.current || !analysisData || !screenshotUrl || !imageRef.current) {
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      
      if (!ctx) return
      
      // Set canvas dimensions to match the screenshot
      canvas.width = viewportSize.width
      canvas.height = viewportSize.height
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw the screenshot as background
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height)
      
      // Generate heatmap data based on gaze points
      const heatmapData = analysisData.gazeData.map(point => ({
        x: point.x * (viewportSize.width / window.innerWidth),
        y: point.y - scrollPosition,
        value: 1
      }))
      
      // Heatmap rendering
      const radius = 50
      const intensity = 0.8
      
      heatmapData.forEach(point => {
        if (point.y >= 0 && point.y <= viewportSize.height) {
          const gradient = ctx.createRadialGradient(
            point.x, point.y, 0,
            point.x, point.y, radius
          )
          gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity})`)
          gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')

          ctx.fillStyle = gradient
          ctx.fillRect(
            point.x - radius,
            point.y - radius,
            radius * 2,
            radius * 2
          )
        }
      })

      setHeatmapGenerated(true)
    } catch (error) {
      console.error('Error generating heatmap:', error)
      setError('Ошибка при генерации тепловой карты')
    } finally {
      setIsGenerating(false)
    }
  }, [analysisData, viewportSize, scrollPosition, screenshotUrl])

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
  const resetHeatmap = useCallback(() => {
    setHeatmapGenerated(false)
    if (canvasRef.current && imageRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.drawImage(imageRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [])

  const stats = getHeatmapStats()

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
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Результаты анализа</CardTitle>
          <CardDescription>
            Анализ страницы: {analysisData?.url || 'Неизвестный URL'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Всего взглядов</p>
              <p className="text-2xl font-bold">{stats.totalPoints}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Общее время</p>
              <p className="text-2xl font-bold">{stats.totalTime} сек</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Частота взглядов</p>
              <p className="text-2xl font-bold">{stats.frequency} взг/сек</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600">Макс. прокрутка</p>
              <p className="text-2xl font-bold">{stats.maxScroll}px</p>
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

          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="border rounded-lg overflow-auto bg-gray-50"
            style={{ 
              height: '70vh',
              maxHeight: '800px',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                ref={imageRef}
                src={screenshotUrl}
                alt="Screenshot of analyzed page"
                className="w-full"
                onLoad={handleImageLoad}
                style={{ display: 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="w-full"
                style={{
                  border: '1px solid #e5e7eb',
                  display: 'block'
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
