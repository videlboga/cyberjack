// Copyright 2026 CyberJack. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/SphereComponent.h"
#include "CyberJackPartInterface.h"
#include "CyberJackAnchorComponent.generated.h"

/**
 * Sphere-коллайдер, привязанный к кости MetaHuman.
 * Содержит CyberJack partId в переменной + дублирует в ComponentTags как `CyberPart:{partId}`
 * — оба способа работают (переменная — для type-safe Blueprint, теги — для рейкастинга в C++).
 */
UCLASS(ClassGroup = (CyberJack), meta = (BlueprintSpawnableComponent), HideCategories = (Object, LOD, Physics, Collision, Lighting, Rendering, Mobile))
class CYBERJACK_API UCyberJackAnchorComponent : public USphereComponent, public ICyberJackPartInterface
{
	GENERATED_BODY()

public:
	UCyberJackAnchorComponent();

	/** PartId этой анатомической точки (например "chest", "nipples_left", "mind_state"). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack")
	FString PartId;

	/** Этот коллайдер — зеркальная копия парной кости (R-сторона)? */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack")
	bool bIsMirrored = false;

	/** Исходное имя кости (для отладки и автотестов). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "CyberJack")
	FName SourceBoneName;

	/**
	 * Установить partId и автоматически проставить тег `CyberPart:{partId}`.
	 * Вызывается менеджером при спавне. Также выставьте SourceBoneName.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	void SetCyberJackPartId(const FString& InPartId, FName InSourceBoneName, bool bInIsMirrored);

	// ICyberJackPartInterface
	virtual FString GetCyberJackPartId_Implementation() const override { return PartId; }
	virtual bool IsMirrored_Implementation() const override { return bIsMirrored; }

	/**
	 * Возвращает partId из тегов компонента.
	 * Полезно в рейкасте, когда у Hit.Component нет указателя на UCyberJackAnchorComponent,
	 * но есть ComponentTags.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	static FString ExtractPartIdFromTags(const TArray<FName>& Tags);

	/** Префикс тега: `CyberPart:`. */
	static const FString TagPrefix;
};
