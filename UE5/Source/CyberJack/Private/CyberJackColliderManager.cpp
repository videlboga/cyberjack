// Copyright 2026 CyberJack. All rights reserved.

#include "CyberJackColliderManager.h"

#include "CyberJackAnchorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/DataTable.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/Actor.h"

UCyberJackColliderManager::UCyberJackColliderManager()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UCyberJackColliderManager::BeginPlay()
{
	Super::BeginPlay();

	// Авто-поиск SkeletalMesh, если не задан явно
	if (!TargetSkeletalMesh)
	{
		if (AActor* Owner = GetOwner())
		{
			TargetSkeletalMesh = Owner->FindComponentByClass<USkeletalMeshComponent>();
		}
	}

	if (bSpawnOnBeginPlay)
	{
		SpawnColliders();
	}
}

int32 UCyberJackColliderManager::SpawnColliders()
{
	ClearColliders();

	if (!AnchorTable)
	{
		UE_LOG(LogTemp, Warning, TEXT("UCyberJackColliderManager::SpawnColliders — AnchorTable is null"));
		return 0;
	}
	if (!TargetSkeletalMesh)
	{
		UE_LOG(LogTemp, Warning, TEXT("UCyberJackColliderManager::SpawnColliders — TargetSkeletalMesh is null"));
		return 0;
	}
	if (!TargetSkeletalMesh->GetSkeletalMeshAsset())
	{
		UE_LOG(LogTemp, Warning, TEXT("UCyberJackColliderManager::SpawnColliders — SkeletalMesh asset is null"));
		return 0;
	}

	const USkeletalMesh* SkelMesh = TargetSkeletalMesh->GetSkeletalMeshAsset();
	if (!SkelMesh)
	{
		return 0;
	}

	// Проверка что DataTable имеет правильный row type
	if (AnchorTable->GetRowStruct() != FCyberJackAnchorRow::StaticStruct())
	{
		UE_LOG(LogTemp, Error, TEXT("UCyberJackColliderManager::SpawnColliders — AnchorTable row struct mismatch"));
		return 0;
	}

	int32 LogicalCount = 0;
	TArray<FName> RowNames = AnchorTable->GetRowNames();

	for (const FName& RowName : RowNames)
	{
		static const FString Context = TEXT("CyberJackColliderManager::SpawnColliders");
		const FCyberJackAnchorRow* Row = AnchorTable->FindRow<FCyberJackAnchorRow>(RowName, Context, /*bWarnIfRowMissing=*/false);
		if (!Row)
		{
			continue;
		}

		// Системные слоты не имеют кости
		if (Row->bIsSystemSlot || Row->BoneName.IsNone())
		{
			continue;
		}

		// Проверяем, что кость существует в скелете
		if (FindBoneIndex(Row->BoneName) == INDEX_NONE)
		{
			UE_LOG(LogTemp, Warning, TEXT("UCyberJackColliderManager::SpawnColliders — bone '%s' not found in skeletal mesh"), *Row->BoneName.ToString());
			continue;
		}

		// В зависимости от BodySide спавним 1 или 2 коллайдера
		switch (Row->BodySide)
		{
		case ECyberJackBodySide::Center:
		case ECyberJackBodySide::Left:
		case ECyberJackBodySide::Right:
		{
			// Один коллайдер. Для Left/Right считаем его single.
			const bool bIsMirrored = (Row->BodySide == ECyberJackBodySide::Right);
			SpawnSingleAnchor(*Row, Row->PartId, Row->BoneName, Row->Offset, Row->Radius, bIsMirrored);
			break;
		}
		case ECyberJackBodySide::Both:
		{
			// Два коллайдера: left + right (mirror X)
			const FString LeftId  = MakePairedPartId(*Row, /*bIsLeftSide=*/true);
			const FString RightId = MakePairedPartId(*Row, /*bIsLeftSide=*/false);
			const FVector MirroredOffset = MirrorOffsetX(Row->Offset);

			SpawnSingleAnchor(*Row, LeftId,  Row->BoneName, Row->Offset,         Row->Radius, /*bIsMirrored=*/false);
			SpawnSingleAnchor(*Row, RightId, Row->BoneName, MirroredOffset,      Row->Radius, /*bIsMirrored=*/true);
			break;
		}
		}

		++LogicalCount;
	}

	UE_LOG(LogTemp, Log, TEXT("UCyberJackColliderManager::SpawnColliders — %d logical anchors, %d collider components"), LogicalCount, SpawnedColliders.Num());
	return LogicalCount;
}

void UCyberJackColliderManager::ClearColliders()
{
	for (UCyberJackAnchorComponent* Collider : SpawnedColliders)
	{
		if (Collider)
		{
			Collider->DestroyComponent();
		}
	}
	SpawnedColliders.Reset();
}

UCyberJackAnchorComponent* UCyberJackColliderManager::SpawnSingleAnchor(
	const FCyberJackAnchorRow& Row,
	const FString& ResolvedPartId,
	FName BoneName,
	const FVector& Offset,
	float Radius,
	bool bIsMirrored)
{
	if (!TargetSkeletalMesh)
	{
		return nullptr;
	}

	const int32 BoneIndex = FindBoneIndex(BoneName);
	if (BoneIndex == INDEX_NONE)
	{
		return nullptr;
	}

	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return nullptr;
	}

	const FName CompName = MakeUniqueObjectName(
		Owner,
		UCyberJackAnchorComponent::StaticClass(),
		FName(*FString::Printf(TEXT("CyberJackAnchor_%s"), *ResolvedPartId)));

	UCyberJackAnchorComponent* NewCollider = NewObject<UCyberJackAnchorComponent>(Owner, CompName);
	if (!NewCollider)
	{
		return nullptr;
	}

	NewCollider->SetSphereRadius(Radius);
	NewCollider->SetCollisionResponseToChannel(ECC_GameTraceChannel1, ECR_Block);
	NewCollider->SetGenerateOverlapEvents(false);
	NewCollider->SetCyberJackPartId(ResolvedPartId, BoneName, bIsMirrored);

	// Регистрируем компонент
	NewCollider->RegisterComponent();

	// Привязываем к кости через FName (работает когда скелет перестраивается)
	NewCollider->AttachToComponent(
		TargetSkeletalMesh,
		FAttachmentTransformRules::SnapToTargetIncludingScale,
		BoneName);

	// Локальное смещение от кости
	NewCollider->SetRelativeLocation(Offset);

	SpawnedColliders.Add(NewCollider);
	return NewCollider;
}

int32 UCyberJackColliderManager::FindBoneIndex(FName BoneName) const
{
	if (!TargetSkeletalMesh)
	{
		return INDEX_NONE;
	}
	const USkeletalMesh* SkelMesh = TargetSkeletalMesh->GetSkeletalMeshAsset();
	if (!SkelMesh)
	{
		return INDEX_NONE;
	}
	return SkelMesh->GetRefSkeleton().FindBoneIndex(BoneName);
}

FString UCyberJackColliderManager::MakePairedPartId(const FCyberJackAnchorRow& Row, bool bIsLeftSide)
{
	// Если BodySide != Both — возвращаем PartId как есть
	if (Row.BodySide != ECyberJackBodySide::Both)
	{
		return Row.PartId;
	}

	// Если PartId уже оканчивается на _left / _right — не дублируем
	const FString Lower = Row.PartId.ToLower();
	if (Lower.EndsWith(TEXT("_left")) || Lower.EndsWith(TEXT("_right")))
	{
		return Row.PartId;
	}

	return Row.PartId + (bIsLeftSide ? TEXT("_left") : TEXT("_right"));
}

FVector UCyberJackColliderManager::MirrorOffsetX(const FVector& In)
{
	return FVector(-In.X, In.Y, In.Z);
}
