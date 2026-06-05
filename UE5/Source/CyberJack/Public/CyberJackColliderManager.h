// Copyright 2026 CyberJack. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "CyberJackAnchorRow.h"
#include "CyberJackColliderManager.generated.h"

class USkeletalMeshComponent;
class UCyberJackAnchorComponent;

/**
 * ACyberJackColliderManager — спавнит UCyberJackAnchorComponent (Sphere) на каждой кости MetaHuman
 * согласно строкам DT_CyberJackAnchors.
 *
 * Использование:
 *  1. Положить компонент на актор, у которого есть USkeletalMeshComponent (MetaHuman).
 *  2. Указать DataTable (DT_CyberJackAnchors) в AnchorTable.
 *  3. Вызвать SpawnColliders() (или это делается автоматически в BeginPlay если задан SkeletalMeshComponent).
 *  4. Для парных строк (BodySide = Both) автоматически спавнится второй коллайдер с mirror по X и суффиксом `_left`/`_right`.
 *
 * Коллайдеры имеют тег `CyberPart:{partId}` и реагируют на UIInteractable (ECC_GameTraceChannel1).
 */
UCLASS(ClassGroup = (CyberJack), meta = (BlueprintSpawnableComponent))
class CYBERJACK_API UCyberJackColliderManager : public UActorComponent
{
	GENERATED_BODY()

public:
	UCyberJackColliderManager();

	/** DataTable типа FCyberJackAnchorRow (DT_CyberJackAnchors). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack")
	TObjectPtr<UDataTable> AnchorTable;

	/**
	 * Skeletal mesh для спавна коллайдеров.
	 * Если nullptr — менеджер попытается найти первый USkeletalMeshComponent на Owner.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack")
	TObjectPtr<USkeletalMeshComponent> TargetSkeletalMesh;

	/** Автоматически спавнить коллайдеры в BeginPlay. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack")
	bool bSpawnOnBeginPlay = true;

	/**
	 * Спавнит коллайдеры. Возвращает количество созданных (без учёта зеркальных).
	 * Парные строки (BodySide = Both) считаются как 1 логическая строка, но спавнят 2 коллайдера.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	int32 SpawnColliders();

	/**
	 * Очищает все спавненные коллайдеры.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	void ClearColliders();

	/**
	 * Возвращает все спавненные коллайдеры (включая зеркальные копии).
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	const TArray<UCyberJackAnchorComponent*>& GetSpawnedColliders() const { return SpawnedColliders; }

	/**
	 * Возвращает partId зеркальной копии для парной строки.
	 * Например, для строки "arms" с BodySide=Both → "arms_left" и "arms_right".
	 * Для одиночной строки (Center/Left/Right) → возвращается PartId как есть.
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	static FString MakePairedPartId(const FCyberJackAnchorRow& Row, bool bIsLeftSide);

	/**
	 * Зеркалирует FVector по оси X (для R-стороны).
	 */
	UFUNCTION(BlueprintCallable, Category = "CyberJack")
	static FVector MirrorOffsetX(const FVector& In);

protected:
	virtual void BeginPlay() override;

	/** Все спавненные коллайдеры (включая зеркальные). Владеет менеджер. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "CyberJack")
	TArray<TObjectPtr<UCyberJackAnchorComponent>> SpawnedColliders;

private:
	/** Спавнит один коллайдер для строки + опционально зеркальную копию. */
	UCyberJackAnchorComponent* SpawnSingleAnchor(
		const FCyberJackAnchorRow& Row,
		const FString& ResolvedPartId,
		FName BoneName,
		const FVector& Offset,
		float Radius,
		bool bIsMirrored);

	/** Ищет кость в SkeletalMesh, возвращает индекс или INDEX_NONE. */
	int32 FindBoneIndex(FName BoneName) const;
};
