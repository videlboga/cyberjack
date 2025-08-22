import { useState, useCallback } from 'react'

export interface ModalState {
  isOpen: boolean
  type: string | null
  data: any
  category?: string
  isNew?: boolean
}

export const useModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: null,
    data: null,
    category: undefined,
    isNew: false
  })

  const openModal = useCallback((type: string, data: any, category?: string, isNew: boolean = false) => {
    setModalState({
      isOpen: true,
      type,
      data,
      category,
      isNew
    })
  }, [])

  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      type: null,
      data: null,
      category: undefined,
      isNew: false
    })
  }, [])

  const updateModalData = useCallback((data: any) => {
    setModalState(prev => ({
      ...prev,
      data
    }))
  }, [])

  return {
    modalState,
    openModal,
    closeModal,
    updateModalData
  }
}

