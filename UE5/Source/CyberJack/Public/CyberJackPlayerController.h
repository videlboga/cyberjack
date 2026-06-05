// Copyright 2026 CyberJack. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "CyberJackPlayerController.generated.h"

class UCyberJackAnchorComponent;
struct FHitResult;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCyberJackPartHover, const FString&, PartId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCyberJackPartClicked, const FString&, PartId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnCyberJackPartUnhover);

/**
 * ACyberJackPlayerController — рейкастит от камеры по ECC_GameTraceChannel1 (UIInteractable),
 * парсит тег `CyberPart:{partId}` из Hit.Component, бродкастит hover/click/unhover события.
 *
 * Для UE5 проекта CyberJack. Подменяет Unity-скрипт InteractionManager.cs из restore-ui.
 */
UCLASS(Blueprintable, BlueprintType)
class CYBERJACK_API ACyberJackPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ACyberJackPlayerController();

	/** Длина рейкаста в см. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Interaction", meta = (ClampMin = "100.0"))
	float InteractionRange = 5000.0f;

	/** Периодичность hover-рейкаста (сек). 0 = каждый кадр. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Interaction", meta = (ClampMin = "0.0"))
	float HoverCheckInterval = 0.0f;

	/** Показывать debug-линию рейкаста. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Interaction|Debug")
	bool bDrawDebugTrace = false;

	/** Цвет линии (hit = зелёный, miss = красный). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Interaction|Debug")
	FColor DebugColorHit = FColor::Green;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Interaction|Debug")
	FColor DebugColorMiss = FColor::Red;

	/** Событие: пользователь навёл курсор на partId (PartId будет пустым в Unhover). */
	UPROPERTY(BlueprintAssignable, Category = "CyberJack|Interaction")
	FOnCyberJackPartHover OnPartHover;

	/** Событие: пользователь кликнул на partId. */
	UPROPERTY(BlueprintAssignable, Category = "CyberJack|Interaction")
	FOnCyberJackPartClicked OnPartClicked;

	/** Событие: курсор ушёл с part. */
	UPROPERTY(BlueprintAssignable, Category = "CyberJack|Interaction")
	FOnCyberJackPartUnhover OnPartUnhover;

	/** Текущий hovered partId (пустая строка = ничего не навёл). */
	UFUNCTION(BlueprintCallable, Category = "CyberJack|Interaction")
	FString GetCurrentHoveredPartId() const { return CurrentHoveredPartId; }

	/**
	 * Делает один рейкаст от камеры. Возвращает hit и partId (если есть).
	 * Можно вызывать вручную (например, для AI-тестов).
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack|Interaction")
	bool PerformInteractionTrace(FHitResult& OutHit, FString& OutPartId) const;

	/**
	 * Статический хелпер: парсит partId из Component'а (тег `CyberPart:`).
	 * Возвращает true если partId найден.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack|Interaction")
	static bool TryGetPartIdFromHitComponent(const UPrimitiveComponent* HitComp, FString& OutPartId);

protected:
	virtual void PlayerTick(float DeltaTime) override;
	virtual void SetupInputComponent() override;

	/** Input action "Interact" — клик мышью. */
	void OnInteractInput();

	/** Текущий hovered partId (для отслеживания изменения hover). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "CyberJack|Interaction")
	FString CurrentHoveredPartId;

	/** Таймер для hover-проверки. */
	float TimeSinceLastHoverCheck = 0.0f;

	/** Хук на изменения hover. */
	void HandleHoverChange(const FString& NewHoveredPartId);
};
