"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Eye, Globe, Timer, Camera } from "lucide-react"

export default function HomePage() {
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [scrollingTime, setScrollingTime] = useState([30])

  const handleStartAnalysis = () => {
    if (!websiteUrl) return

    const params = new URLSearchParams({
      url: websiteUrl,
      time: scrollingTime[0].toString(),
    })

    window.location.href = `/calibration?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Eye className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">GazeMap Analytics</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Автоматизированная система создания и анализа тепловых карт взгляда пользователей для повышения
            эффективности веб-интерфейсов
          </p>
        </div>

        {/* Main Configuration Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Настройка анализа
            </CardTitle>
            <CardDescription>
              Введите URL веб-сайта и настройте параметры для создания тепловой карты взглядов
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="website-url">URL веб-сайта</Label>
              <Input
                id="website-url"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="text-lg"
              />
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Время на скроллинг: {scrollingTime[0]} секунд
              </Label>
              <Slider
                value={scrollingTime}
                onValueChange={setScrollingTime}
                max={120}
                min={10}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>10 сек</span>
                <span>60 сек</span>
                <span>120 сек</span>
              </div>
            </div>

            <Button onClick={handleStartAnalysis} disabled={!websiteUrl} className="w-full text-lg py-6" size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Начать анализ
            </Button>
          </CardContent>
        </Card>

        {/* Process Steps */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-indigo-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Настройка</h3>
              <p className="text-sm text-gray-600">Введите URL и время анализа</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-indigo-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Калибровка</h3>
              <p className="text-sm text-gray-600">Калибровка камеры по всему экрану</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-indigo-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Анализ</h3>
              <p className="text-sm text-gray-600">Отслеживание взгляда при скроллинге</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-indigo-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Результат</h3>
              <p className="text-sm text-gray-600">Тепловая карта и экспорт</p>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Возможности системы</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Отслеживание взгляда через веб-камеру
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Полноэкранная калибровка
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Анализ полной высоты страницы
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Экспорт в PNG и PDF
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Применение</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Улучшение веб-дизайна
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Оценка эффективности интерфейсов
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Исследования пользовательского поведения
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Анализ восприятия контента
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
