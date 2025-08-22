import React, { useState, useEffect } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react"

interface SyncStatusProps {
  isSynced: boolean
  lastSync?: Date
  onSync?: () => void
  differences?: string[]
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  isSynced,
  lastSync,
  onSync,
  differences = []
}) => {
  const [formattedTime, setFormattedTime] = useState<string>('')

  useEffect(() => {
    if (lastSync) {
      setFormattedTime(lastSync.toLocaleString())
    }
  }, [lastSync])

  return (
    <div className="flex items-center gap-2">
      {isSynced ? (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Синхронизировано
        </Badge>
      ) : (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Не синхронизировано
        </Badge>
      )}
      
      {lastSync && (
        <span className="text-xs text-muted-foreground">
          Последняя синхронизация: {formattedTime}
        </span>
      )}
      
      {onSync && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          className="h-6 px-2"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
      
      {differences.length > 0 && (
        <div className="text-xs text-red-600">
          {differences.length} различий
        </div>
      )}
    </div>
  )
}
