// Copyright 2026 CyberJack. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "CyberJackAnchorRow.generated.h"

/**
 * Тип коллайдера для анатомической точки MetaHuman.
 */
UENUM(BlueprintType)
enum class ECyberJackColliderType : uint8
{
	None        UMETA(DisplayName = "None"),
	Sphere      UMETA(DisplayName = "Sphere"),
	Box         UMETA(DisplayName = "Box"),
	Capsule     UMETA(DisplayName = "Capsule")
};

/**
 * Сторона (Left/Right/Both) для парных анатомических точек.
 * Both используется для парных по умолчанию (shoulders, arms, legs, feet, hands, nipples).
 */
UENUM(BlueprintType)
enum class ECyberJackBodySide : uint8
{
	Left        UMETA(DisplayName = "Left (mirror X+)"),
	Right       UMETA(DisplayName = "Right (mirror X-)"),
	Both        UMETA(DisplayName = "Both (L + R)"),
	Center      UMETA(DisplayName = "Center (single)")
};

/**
 * Строка DataTable `DT_CyberJackAnchors` — описание одной анатомической точки.
 *
 * Соответствует таблице в docs/CyberJack-UE5-integration-plan.md (раздел 1.1).
 * Одна строка может спавнить один или два коллайдера (для парных костей — Left/Right).
 */
USTRUCT(BlueprintType)
struct CYBERJACK_API FCyberJackAnchorRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Уникальный id анатомической точки (например "chest", "nipples", "left_arm"). Должен матчиться с ядром CyberJack (anatomy.ts). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	FString PartId;

	/** Имя кости MetaHuman (например "spine_05", "pelvis", "clavicle_l"). Пусто = системный слот (posture, mind_state, systemic, slot_room, slot_social). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	FName BoneName;

	/** Сторона тела для парных точек. Both = два коллайдера (mirror X). Center = один. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	ECyberJackBodySide BodySide = ECyberJackBodySide::Center;

	/** Тип коллайдера. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	ECyberJackColliderType ColliderType = ECyberJackColliderType::Sphere;

	/** Смещение центра коллайдера от кости (в локальных координатах кости, см). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	FVector Offset = FVector::ZeroVector;

	/** Радиус сферы / половина бокса / радиус капсулы. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor", meta = (ClampMin = "0.1"))
	float Radius = 5.0f;

	/** Human-readable label для UI (русский). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	FString Label;

	/** Дефолтная localSensitivity (для запросов /api/state). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float SensDefault = 50.0f;

	/** Дефолтный localAttitude (для запросов /api/state). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float AttDefault = 50.0f;

	/** Если true — системный слот (не привязан к кости), не спавнит коллайдер. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CyberJack|Anchor")
	bool bIsSystemSlot = false;
};
