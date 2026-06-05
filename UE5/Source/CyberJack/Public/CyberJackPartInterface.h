// Copyright 2026 CyberJack. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "CyberJackPartInterface.generated.h"

/**
 * Маркер-интерфейс для любого объекта, имеющего CyberJack partId.
 * Реализуется USphereComponent'ами, навешенными менеджером на кости MetaHuman.
 * Используется тег-фолбэк через GetComponentByInterface / Blueprint.
 */
UINTERFACE(BlueprintType, MinimalAPI)
class UCyberJackPartInterface : public UInterface
{
	GENERATED_BODY()
};

class ICyberJackPartInterface
{
	GENERATED_BODY()

public:
	/** Возвращает CyberJack partId (например "chest", "nipples_left", "mind_state"). */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "CyberJack")
	FString GetCyberJackPartId() const;
	virtual FString GetCyberJackPartId_Implementation() const { return FString(); }

	/** Возвращает true если этот объект — зеркальная копия (R-сторона). */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "CyberJack")
	bool IsMirrored() const;
	virtual bool IsMirrored_Implementation() const { return false; }
};
