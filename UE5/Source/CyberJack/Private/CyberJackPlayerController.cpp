// Copyright 2026 CyberJack. All rights reserved.

#include "CyberJackPlayerController.h"

#include "CyberJackAnchorComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Components/PrimitiveComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/World.h"

ACyberJackPlayerController::ACyberJackPlayerController()
{
	bShowMouseCursor = true;
	bEnableClickEvents = true;
	bEnableMouseOverEvents = true;
	DefaultMouseCursor = EMouseCursor::Default;
}

void ACyberJackPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	if (InputComponent)
	{
		// Левый клик мыши
		InputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &ACyberJackPlayerController::OnInteractInput).bExecuteWhenPaused = true;
	}
}

void ACyberJackPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	TimeSinceLastHoverCheck += DeltaTime;
	if (TimeSinceLastHoverCheck < HoverCheckInterval)
	{
		return;
	}
	TimeSinceLastHoverCheck = 0.0f;

	FHitResult Hit;
	FString PartId;
	const bool bHit = PerformInteractionTrace(Hit, PartId);

	if (bHit && !PartId.IsEmpty())
	{
		if (PartId != CurrentHoveredPartId)
		{
			HandleHoverChange(PartId);
		}
	}
	else if (!CurrentHoveredPartId.IsEmpty())
	{
		HandleHoverChange(FString());
	}
}

bool ACyberJackPlayerController::PerformInteractionTrace(FHitResult& OutHit, FString& OutPartId) const
{
	OutPartId.Reset();

	UWorld* World = GetWorld();
	if (!World)
	{
		return false;
	}

	APlayerCameraManager* Cam = PlayerCameraManager;
	if (!Cam)
	{
		return false;
	}

	const FVector CameraLocation = Cam->GetCameraLocation();
	const FRotator CameraRotation = Cam->GetCameraRotation();
	const FVector CameraForward = CameraRotation.Vector();
	const FVector TraceEnd = CameraLocation + CameraForward * InteractionRange;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(CyberJackInteraction), /*bTraceComplex=*/false, GetPawn());
	Params.bReturnPhysicalMaterial = false;

	// Рейкаст по UIInteractable (ECC_GameTraceChannel1)
	const bool bHit = World->LineTraceSingleByChannel(
		OutHit,
		CameraLocation,
		TraceEnd,
		ECC_GameTraceChannel1,
		Params);

#if ENABLE_DRAW_DEBUG
	if (bDrawDebugTrace)
	{
		const FColor Color = bHit ? DebugColorHit : DebugColorMiss;
		DrawDebugLine(World, CameraLocation, TraceEnd, Color, false, 0.0f, 0, 1.0f);
		if (bHit)
		{
			DrawDebugPoint(World, OutHit.ImpactPoint, 8.0f, Color, false, 0.5f);
		}
	}
#endif

	if (!bHit)
	{
		return false;
	}

	// Попытка 1: типобезопасное получение из UCyberJackAnchorComponent
	if (UPrimitiveComponent* HitComp = OutHit.GetComponent())
	{
		if (UCyberJackAnchorComponent* Anchor = Cast<UCyberJackAnchorComponent>(HitComp))
		{
			OutPartId = Anchor->PartId;
			return true;
		}
		// Попытка 2: парсинг тегов
		if (TryGetPartIdFromHitComponent(HitComp, OutPartId))
		{
			return true;
		}
	}

	return false;
}

bool ACyberJackPlayerController::TryGetPartIdFromHitComponent(const UPrimitiveComponent* HitComp, FString& OutPartId)
{
	if (!HitComp)
	{
		return false;
	}
	OutPartId = UCyberJackAnchorComponent::ExtractPartIdFromTags(HitComp->ComponentTags);
	return !OutPartId.IsEmpty();
}

void ACyberJackPlayerController::OnInteractInput()
{
	FHitResult Hit;
	FString PartId;
	if (PerformInteractionTrace(Hit, PartId) && !PartId.IsEmpty())
	{
		OnPartClicked.Broadcast(PartId);
	}
}

void ACyberJackPlayerController::HandleHoverChange(const FString& NewHoveredPartId)
{
	const FString Old = CurrentHoveredPartId;

	if (!Old.IsEmpty() && Old != NewHoveredPartId)
	{
		// Unhover предыдущего
		OnPartUnhover.Broadcast();
		// Поменять курсор обратно на default
		DefaultMouseCursor = EMouseCursor::Default;
	}

	CurrentHoveredPartId = NewHoveredPartId;

	if (!CurrentHoveredPartId.IsEmpty())
	{
		// Hover нового
		DefaultMouseCursor = EMouseCursor::Crosshairs;
		OnPartHover.Broadcast(CurrentHoveredPartId);
	}
}
