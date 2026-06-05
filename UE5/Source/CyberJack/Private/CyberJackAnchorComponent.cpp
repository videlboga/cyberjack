// Copyright 2026 CyberJack. All rights reserved.

#include "CyberJackAnchorComponent.h"

const FString UCyberJackAnchorComponent::TagPrefix = TEXT("CyberPart:");

UCyberJackAnchorComponent::UCyberJackAnchorComponent()
{
	PrimaryComponentTick.bCanEverTick = false;

	// Реагируем только на UIInteractable channel (ECC_GameTraceChannel1)
	SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	SetCollisionObjectType(ECC_WorldDynamic);
	SetCollisionResponseToAllChannels(ECR_Ignore);
	SetCollisionResponseToChannel(ECC_GameTraceChannel1, ECR_Block); // UIInteractable
	SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	SetGenerateOverlapEvents(false);
	SetCanEverAffectNavigation(false);

	// По умолчанию небольшой радиус
	SetSphereRadius(5.0f);

	// Сделать линии видимыми в PIE для отладки
	bHiddenInGame = false;
}

void UCyberJackAnchorComponent::SetCyberJackPartId(const FString& InPartId, FName InSourceBoneName, bool bInIsMirrored)
{
	PartId = InPartId;
	SourceBoneName = InSourceBoneName;
	bIsMirrored = bInIsMirrored;

	// Чистим старые теги CyberPart:*
	ComponentTags.RemoveAll([](const FName& Tag) { return Tag.ToString().StartsWith(TagPrefix); });

	// Добавляем новый
	const FString FullTag = TagPrefix + InPartId;
	ComponentTags.Add(FName(*FullTag));
}

FString UCyberJackAnchorComponent::ExtractPartIdFromTags(const TArray<FName>& Tags)
{
	for (const FName& Tag : Tags)
	{
		const FString TagStr = Tag.ToString();
		if (TagStr.StartsWith(TagPrefix))
		{
			return TagStr.RightChop(TagPrefix.Len());
		}
	}
	return FString();
}
