"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import {
  ChevronRight,
  Users,
  Brain,
  Cog,
  DollarSign,
  Calendar,
  AlertTriangle,
  BarChart3,
  Code,
  Gamepad2,
} from "lucide-react"

const sections = [
  { id: "concept", title: "Концепт игры", icon: Gamepad2, color: "bg-blue-500" },
  { id: "loop", title: "Игровой цикл", icon: Calendar, color: "bg-green-500" },
  { id: "talents", title: "Источники талантов", icon: Users, color: "bg-purple-500" },
  { id: "stats", title: "Характеристики", icon: BarChart3, color: "bg-orange-500" },
  { id: "psychology", title: "Психо-профиль", icon: Brain, color: "bg-pink-500" },
  { id: "actions", title: "Действия", icon: Cog, color: "bg-teal-500" },
  { id: "character-ai", title: "Взаимодействия", icon: Brain, color: "bg-cyan-500" },
  { id: "fetishes", title: "Фетиши и предпочтения", icon: Users, color: "bg-indigo-500" },
  { id: "economy", title: "Экономика", icon: DollarSign, color: "bg-yellow-500" },
  { id: "events", title: "События и риски", icon: AlertTriangle, color: "bg-red-500" },
  { id: "technical", title: "Техническая часть", icon: Code, color: "bg-gray-500" },
]

export default function TalentArchitectGDD() {
  const [activeSection, setActiveSection] = useState("concept")
  const [characterAIConfig, setCharacterAIConfig] = useState(null)

  // Загружаем конфигурацию Character AI
  useEffect(() => {
    if (activeSection === "character-ai") {
      fetch('/api/character-ai-config')
        .then(res => res.json())
        .then(data => setCharacterAIConfig(data))
        .catch(err => console.error('Ошибка загрузки конфигурации Character AI:', err))
    }
  }, [activeSection])

  const renderContent = () => {
    switch (activeSection) {
      case "concept":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Nexus Enslaver
                </CardTitle>
                <CardDescription>NSFW игра с BDSM элементами в сеттинге космической станции</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Место действия:</h4>
                  <p>
                    Станция-мегаполис Nexus Prime, окружённая «Космической Тенью» (аномальная зона, побег невозможен)
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Секторы:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge variant="outline">Core Sector (элита)</Badge>
                    <Badge variant="outline">Fringe Districts (периферия)</Badge>
                    <Badge variant="outline">Void Border (опасная граница)</Badge>
                    <Badge variant="outline">Neural Hub (технологии)</Badge>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Роль игрока:</h4>
                  <p>
                    Мастер активов на космической станции. Приобретение, тренировка, кондиционирование, управление
                    имплантами, выполнение контрактов, рост репутации и статуса (от скваттера до CEO).
                  </p>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <h4 className="font-semibold mb-2 text-amber-800">Ключевой баланс:</h4>
                  <p className="text-amber-700">
                    Жесткость vs забота — пытки и давление дают быстрые результаты, но ведут к
                    страху/отчаянию и потере активов.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "loop":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Суточный цикл игры</CardTitle>
                <CardDescription>Daily Core Loop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { phase: "Планирование", desc: "Распределение НП, выбор действий, установка правил" },
                    { phase: "Симуляция", desc: "Выполнение действий → проверки успеха → изменения параметров" },
                    { phase: "RAG-пайплайн", desc: "Генерация/актуализация воспоминаний и модификаторов" },
                    { phase: "Экономика", desc: "Начисление расходов/доходов, обновление предложений рынка" },
                    { phase: "События", desc: "Аномалии, проверки корпораций, кризисы персонала" },
                    { phase: "Итоги дня", desc: "Отчёты, уровни нагрузки, риск-флаги; автосейв" },
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{item.phase}</h4>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "talents":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Источники активов</CardTitle>
                <CardDescription>Способы приобретения активов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      name: "Asset Exchange (Core)",
                      desc: "Аукцион. 3–5 активов/день. Видны 1–2 скрытых черт. Старт: низкий страх, высокий Ego.",
                      color: "bg-blue-100 border-blue-300",
                    },
                    {
                      name: "Void Rescues (Void Border)",
                      desc: "Stealth-вылазки (тратят НП). Спасаешь людей из аномальных зон. Рекрутинг добровольный — через доверительный диалог.",
                      color: "bg-purple-100 border-purple-300",
                    },
                    {
                      name: "Corporate Contracts",
                      desc: "Корпорации дают задачи на развитие/сертификацию. Контракты могут прикреплять кандидатов к проектам с KPI.",
                      color: "bg-green-100 border-green-300",
                    },
                    {
                      name: "Neural Forge",
                      desc: "Кастом-онбординг: задаёшь 1–3 аффинности к типам задач; возможен скрытый прошлый опыт.",
                      color: "bg-orange-100 border-orange-300",
                    },
                    {
                      name: "Grey Market Dock",
                      desc: "Серые навыковые пакеты/апгрейды (репутационные риски).",
                      color: "bg-gray-100 border-gray-300",
                    },
                  ].map((source, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${source.color}`}>
                      <h4 className="font-semibold mb-2">{source.name}</h4>
                      <p className="text-sm">{source.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "stats":
        return (
          <div className="space-y-6">
            <Tabs defaultValue="base" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="base">Базовые атрибуты</TabsTrigger>
                <TabsTrigger value="dynamic">Динамические состояния</TabsTrigger>
              </TabsList>

              <TabsContent value="base" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Базовые атрибуты (0–5)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { name: "Strength", desc: "Физическая выносливость/импланты" },
                        { name: "Empathy", desc: "Командное взаимодействие, отклик на коучинг" },
                        { name: "Intelligence", desc: "Скорость обучения и адаптации" },
                        { name: "Temperament", desc: "Реактивность/порывистость" },
                        { name: "Grit", desc: "Стойкость к стрессу" },
                        {
                          name: "Ego",
                          desc: "Самоуверенность/самозащита (высокий Ego мешает принятию обратной связи)",
                        },
                      ].map((attr, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold text-blue-700">{attr.name}</h4>
                          <p className="text-sm text-gray-600">{attr.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dynamic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Динамические состояния</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { name: "Mood", desc: "Зелёный ×1.5 обучаемость, красный ×0.5", color: "border-l-green-500" },
                        { name: "Anxiety", desc: "Тревожность от дедлайнов/аномалий", color: "border-l-red-500" },
                        { name: "Burnout", desc: "Выгорание; при 4+ риск ухода", color: "border-l-orange-500" },
                        {
                          name: "Entitlement",
                          desc: "Ожидание льгот; без рамок снижает дисциплину",
                          color: "border-l-purple-500",
                        },
                        { name: "Insight", desc: "Самоосознанность; снижает Ego", color: "border-l-blue-500" },
                        {
                          name: "Engagement",
                          desc: "Вовлечённость; при ≥3 — статус ассистента-наставника",
                          color: "border-l-teal-500",
                        },
                      ].map((state, index) => (
                        <div key={index} className={`p-3 bg-gray-50 rounded-lg border-l-4 ${state.color}`}>
                          <h4 className="font-semibold">{state.name}</h4>
                          <p className="text-sm text-gray-600">{state.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )

      case "psychology":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Психо-профиль и RAG-память</CardTitle>
                <CardDescription>Система динамической памяти персонажей</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Компоненты профиля:</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h5 className="font-medium text-blue-800">Affinities (0–5)</h5>
                      <p className="text-sm text-blue-700">Склонности к типам задач/сред</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <h5 className="font-medium text-red-800">Stressors/Phobias (0–5)</h5>
                      <p className="text-sm text-red-700">
                        Триггеры тревожности (толпы, замкнутые пространства, высота, аудит)
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <h5 className="font-medium text-green-800">Memories (10–20 слотов)</h5>
                      <p className="text-sm text-green-700">Positive / Traumatic / Professional</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Пример структуры памяти:</h4>
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                    {`{
  "id": "mem_9f3",
  "actorId": "tal_42",
  "type": "Traumatic|Positive|Professional",
  "tags": ["audit", "void", "team"],
  "intensity": 0.0-1.0,
  "summary": "Краткое событие",
  "effect": {"anxietyMod": 0.2, "engagementMod": -0.1},
  "createdAt": "D12",
  "decays": {"perDay": 0.02}
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "actions":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Действия (трата НП)</CardTitle>
                <CardDescription>Базовые действия для развития талантов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Training",
                      desc: "Рост навыков. Success = (Int + Mood - Ego + Facility + Mentor)/10",
                      icon: "📚",
                    },
                    {
                      name: "Coaching / 1:1 Talk",
                      desc: "Раскрывает аффинности/стрессы; Insight↑, Trust↑",
                      icon: "💬",
                    },
                    {
                      name: "Psycho-Scan",
                      desc: "Частично раскрывает скрытые трейты/триггеры из RAG (2 cr)",
                      icon: "🧠",
                    },
                    { name: "Skill Conditioning", desc: "Ускоренное обучение без «ломки личности»", icon: "⚡" },
                    { name: "Rules/Policies", desc: "Сон/жильё, графики, перерывы, прозрачность бонусов", icon: "📋" },
                    {
                      name: "Rewards",
                      desc: "Praise, Perks (жильё, Neural Spa), выходные, оплачиваемые курсы",
                      icon: "🎁",
                    },
                    { name: "Therapy", desc: "Anxiety/Burnout↓, Insight/Trust↑", icon: "🏥" },
                    { name: "VR Simulations", desc: "Тренажёр задач с измерением Cognitive Load", icon: "🥽" },
                  ].map((action, index) => (
                    <div key={index} className="p-4 bg-white border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{action.icon}</span>
                        <div>
                          <h4 className="font-semibold">{action.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{action.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "character-ai":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Иерархия взаимодействий
                </CardTitle>
                <CardDescription>Реальная конфигурация системы взаимодействий</CardDescription>
              </CardHeader>
              <CardContent>
                {!characterAIConfig ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Загрузка конфигурации...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Статус системы */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold mb-2 text-blue-800">Статус системы</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Конфигурация:</span>
                          <Badge className="ml-2 bg-green-100 text-green-800">Загружена</Badge>
                        </div>
                        <div>
                          <span className="text-gray-600">Действий:</span>
                          <Badge className="ml-2 bg-blue-100 text-blue-800">{Object.keys(characterAIConfig.actions || {}).length}</Badge>
                        </div>
                        <div>
                          <span className="text-gray-600">Инструментов:</span>
                          <Badge className="ml-2 bg-purple-100 text-purple-800">{Object.keys(characterAIConfig.tools || {}).length}</Badge>
                        </div>
                        <div>
                          <span className="text-gray-600">Поз:</span>
                          <Badge className="ml-2 bg-orange-100 text-orange-800">{Object.keys(characterAIConfig.poses || {}).length}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Действия */}
                    <div>
                      <h4 className="font-semibold mb-3">Действия ({Object.keys(characterAIConfig.actions || {}).length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(characterAIConfig.actions || {}).map(([id, action]: [string, any]) => (
                          <div key={id} className="p-4 bg-white border rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{action.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{action.name}</h4>
                                  <Badge variant="outline" className="text-xs">{action.category}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Интенсивность:</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-cyan-500 h-2 rounded-full" 
                                        style={{ width: `${(action.intensity / 10) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500">{action.intensity}/10</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Стоимость:</span>
                                    <Badge variant="outline" className="text-xs">{action.cost} НП</Badge>
                                  </div>
                                  {action.cooldown > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">КД:</span>
                                      <Badge variant="outline" className="text-xs">{action.cooldown}с</Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Инструменты */}
                    <div>
                      <h4 className="font-semibold mb-3">Инструменты ({Object.keys(characterAIConfig.tools || {}).length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(characterAIConfig.tools || {}).map(([id, tool]: [string, any]) => (
                          <div key={id} className="p-4 bg-white border rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{tool.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{tool.name}</h4>
                                  <Badge variant="outline" className="text-xs">{tool.type}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{tool.description}</p>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Интенсивность:</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-purple-500 h-2 rounded-full" 
                                        style={{ width: `${(tool.intensity / 10) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500">{tool.intensity}/10</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Длительность:</span>
                                    <Badge variant="outline" className="text-xs">{tool.duration}с</Badge>
                                  </div>
                                  {tool.cooldown > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">КД:</span>
                                      <Badge variant="outline" className="text-xs">{tool.cooldown}с</Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Позы */}
                    <div>
                      <h4 className="font-semibold mb-3">Позы ({Object.keys(characterAIConfig.poses || {}).length})</h4>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800 mb-2">
                          Позы отображаются в игровых режимах для избежания дублирования.
                        </p>
                        <div className="flex gap-2">
                          <Link href="/game">
                            <Button variant="outline" size="sm">
                              🎮 Управление позами в игре
                            </Button>
                          </Link>
                          <Link href="/prod">
                            <Button variant="outline" size="sm">
                              🚀 Использование поз в продакшн
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Ссылки */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Быстрые ссылки</h4>
                      <div className="flex gap-2 flex-wrap">
                        <Link href="/game-unified">
                          <Button variant="default" size="sm">
                            ⚙️ Единая админка (NEW)
                          </Button>
                        </Link>
                        <Link href="/prod">
                          <Button variant="outline" size="sm">
                            🚀 Продакшн
                          </Button>
                        </Link>
                        <Link href="/game">
                          <Button variant="outline" size="sm">
                            🎮 Старая игра
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case "economy":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Экономическая система</CardTitle>
                <CardDescription>Доходы, расходы и репутация</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-green-700">💰 Доходы</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• Выполнение контрактов (фикс + KPI-бонусы)</li>
                      <li>• Placement Fees: комиссия агентства при устройстве</li>
                      <li>• Побочные сервисы: калибровки/обучение</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-red-700">💸 Расходы</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• Аренда (50–150/10 дней)</li>
                      <li>• Питание (1–20/день/чел)</li>
                      <li>• Импланты (50+)</li>
                      <li>• Терапия, страховки</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2 text-blue-800">Формула Placement Fee:</h4>
                  <code className="text-sm bg-white p-2 rounded block">
                    Fee = Base × RankMul × (1 + Reputation/10) × (1 + RareSkills×0.1) × MoodFactor × Scarcity
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "events":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>События и риски</CardTitle>
                <CardDescription>Случайные события, влияющие на игровой процесс</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      name: "Аномалии (Void)",
                      desc: "Меняют часть Memories (не всегда плохо), дают редкие трейты",
                      color: "bg-purple-100 border-purple-300",
                      icon: "🌀",
                    },
                    {
                      name: "Корп-аудит",
                      desc: "Проверка политик/безопасности; штрафы/бонусы к репутации",
                      color: "bg-blue-100 border-blue-300",
                      icon: "📊",
                    },
                    {
                      name: "Implant Fail",
                      desc: "Временные побочки, требуются Med-Scan/калибровки",
                      color: "bg-red-100 border-red-300",
                      icon: "⚠️",
                    },
                    {
                      name: "Персональные кризисы",
                      desc: "При Burnout≥4 — отпуск/перевод/уход",
                      color: "bg-orange-100 border-orange-300",
                      icon: "😰",
                    },
                    {
                      name: "Трудовые конфликты",
                      desc: "Если (Ego − Trust) велико и PolicyFairness низкая — массовые увольнения",
                      color: "bg-yellow-100 border-yellow-300",
                      icon: "⚡",
                    },
                  ].map((event, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${event.color}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{event.icon}</span>
                        <div>
                          <h4 className="font-semibold">{event.name}</h4>
                          <p className="text-sm mt-1">{event.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "technical":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Техническая архитектура</CardTitle>
                <CardDescription>Системы и структура данных</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Архитектурные слои:</h4>
                  <div className="space-y-2">
                    {[
                      { layer: "Domain", desc: "Модели, формулы, правила" },
                      {
                        layer: "Application",
                        desc: "DayCycleSystem, ActionSystem, ContractSystem, RAGClient, EventBus, Economy",
                      },
                      { layer: "Infrastructure", desc: "Сохранения, локализация, телеметрия, серый рынок/магазин" },
                      { layer: "UI", desc: "Экраны планирования, карточки талантов, доска контрактов, окно памяти" },
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Badge variant="outline">{item.layer}</Badge>
                        <p className="text-sm">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Unity Implementation</h4>
                    <ul className="text-sm space-y-1">
                      <li>• ScriptableObjects для каталога контента</li>
                      <li>• Systems как MonoBehaviour-сервисы</li>
                      <li>• Addressables для таблиц и локализации</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Unreal Implementation</h4>
                    <ul className="text-sm space-y-1">
                      <li>• DataAssets для контента</li>
                      <li>• Subsystems (GameInstanceSubsystem)</li>
                      <li>• UMG/WBP для UI</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return <div>Выберите раздел для просмотра</div>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Nexus Enslaver</h1>
          <p className="text-xl text-gray-600">Game Design Document</p>
          <div className="flex gap-2 mt-4">
            <Badge className="mt-2">NSFW BDSM игра</Badge>
            <Link href="/game">
              <Button className="bg-green-600 hover:bg-green-700">🎮 Играть (Dev)</Button>
            </Link>
            <Link href="/prod">
              <Button className="bg-purple-600 hover:bg-purple-700">🚀 Продакшн-версия</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Разделы</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-1 p-4">
                    {sections.map((section) => (
                      <Button
                        key={section.id}
                        variant={activeSection === section.id ? "default" : "ghost"}
                        className="w-full justify-start text-left h-auto p-3"
                        onClick={() => setActiveSection(section.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${section.color} flex items-center justify-center`}>
                            <section.icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-sm">{section.title}</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <ScrollArea className="h-[800px]">{renderContent()}</ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
