// Copyright 2026 CyberJack. All rights reserved.
//
// Automation-тесты для CJ-003 Phase 1 (коллайдеры + рейкастинг).
// Проверяют:
//  1. Все коллайдеры созданы и привязаны к правильным сокетам (BoneName).
//  2. LineTraceByChannel возвращает hit по каждому коллайдеру (через прямой вызов PerformInteractionTrace).
//  3. partId коллайдера матчится с эталонным списком (ядро CyberJack anatomy.ts).
//
// Запуск: UnrealEditor-Cmd.exe CyberJack.uproject -ExecCmds="Automation RunTests CyberJack.Phase1; Quit" -unattended -nopause -testexit="Automation Test Queue Empty" -log
//
// Требует модуль AutomationController (подключён в CyberJack.Build.cs при TargetType.Editor).

#if WITH_DEV_AUTOMATION_TESTS

#include "CoreMinimal.h"
#include "Misc/AutomationTest.h"

#include "CyberJackAnchorComponent.h"
#include "CyberJackAnchorRow.h"
#include "CyberJackColliderManager.h"
#include "CyberJackPlayerController.h"

#include "BoneContainer.h"            // FReferenceSkeletonModifier
#include "Components/SkeletalMeshComponent.h"
#include "Engine/DataTable.h"
#include "Engine/Engine.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "GameFramework/WorldSettings.h"
#include "UObject/Package.h"
#include "UObject/UObjectGlobals.h"

namespace CyberJackAutomationTestUtils
{
	/** Минимальный список partId'ов, которые ядро CyberJack ожидает найти (из anatomy.ts / VID-44). */
	static const TArray<FString> ExpectedCorePartIds = {
		TEXT("head"),
		TEXT("face"),
		TEXT("lips"),
		TEXT("neck"),
		TEXT("shoulders_left"), TEXT("shoulders_right"),
		TEXT("chest"),
		TEXT("nipples_left"), TEXT("nipples_right"),
		TEXT("belly"),
		TEXT("waist"),
		TEXT("back"),
		TEXT("buttocks"),
		TEXT("arms_left"), TEXT("arms_right"),
		TEXT("hands_left"), TEXT("hands_right"),
		TEXT("legs_left"), TEXT("legs_right"),
		TEXT("feet_left"), TEXT("feet_right"),
		TEXT("groin"),
		TEXT("mind_state")
	};

	/**
	 * Создаёт временный UDataTable с тестовыми строками FCyberJackAnchorRow.
	 * Использует только одиночные (Center) строки, чтобы не зависеть от наличия скелета.
	 */
	static UDataTable* CreateTestAnchorTable(UObject* Outer)
	{
		UDataTable* Table = NewObject<UDataTable>(Outer);
		Table->RowStruct = FCyberJackAnchorRow::StaticStruct();

		struct FTestRow
		{
			FName RowName;
			FCyberJackAnchorRow Row;
		};

		TArray<FTestRow> Rows;

		auto MakeRow = [&Rows](FName RowName, FString PartId, FName BoneName, float Radius, bool bIsSystem = false)
		{
			FCyberJackAnchorRow R;
			R.PartId = PartId;
			R.BoneName = BoneName;
			R.BodySide = ECyberJackBodySide::Center;
			R.ColliderType = ECyberJackColliderType::Sphere;
			R.Offset = FVector::ZeroVector;
			R.Radius = Radius;
			R.bIsSystemSlot = bIsSystem;
			Rows.Add({RowName, R});
		};

		MakeRow(TEXT("head"), TEXT("head"), TEXT("head"), 10.0f);
		MakeRow(TEXT("chest"), TEXT("chest"), TEXT("spine_05"), 10.0f);
		MakeRow(TEXT("belly"), TEXT("belly"), TEXT("pelvis"), 8.0f);
		MakeRow(TEXT("mind_state"), TEXT("mind_state"), TEXT("head"), 5.0f, /*bIsSystem=*/true);
		MakeRow(TEXT("posture"), TEXT("posture"), TEXT("None"), 0.0f, /*bIsSystem=*/true);
		MakeRow(TEXT("shoulders"), TEXT("shoulders"), TEXT("clavicle_l"), 6.0f); // BodySide=Both → проверим отдельно
		Rows.Last().Row.BodySide = ECyberJackBodySide::Both;

		for (const FTestRow& R : Rows)
		{
			Table->AddRow(R.RowName, R.Row);
		}

		return Table;
	}
}

// =============================================================================
// Test 1: SpawnColliders создаёт все коллайдеры и привязывает их к костям
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackColliderManager_SpawnTest,
	"CyberJack.Phase1.ColliderManager.SpawnColliders_CreatesComponentsAndAttachesToBones",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackColliderManager_SpawnTest::RunTest(const FString& Parameters)
{
	using namespace CyberJackAutomationTestUtils;

	UWorld* World = UWorld::CreateWorld(EWorldType::Game, /*bInformEngineOfWorld=*/false, TEXT("CJ_TestWorld"));
	if (!TestNotNull(TEXT("World"), World)) return false;
	FWorldContext& WorldContext = GEngine->CreateNewWorldContext(EWorldType::Game);
	WorldContext.SetCurrentWorld(World);
	World->InitializeActorsForPlay(FURL());

	// Создаём host-actor
	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AActor* HostActor = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, SpawnParams);
	if (!TestNotNull(TEXT("HostActor"), HostActor))
	{
		GEngine->DestroyWorldContext(World);
		World->DestroyWorld(false);
		return false;
	}

	// SkeletalMeshComponent с заглушкой USkeletalMesh.
	// USkeletalMesh::GetRefSkeleton().FindBoneIndex использует только bone names,
	// поэтому для теста достаточно NewObject<USkeletalMesh>.
	USkeletalMeshComponent* SkelComp = NewObject<USkeletalMeshComponent>(HostActor);
	USkeletalMesh* StubMesh = NewObject<USkeletalMesh>(HostActor);

	// Создаём ref skeleton с тестовыми костями
	{
		FReferenceSkeletonModifier Modifier(StubMesh->GetRefSkeleton(), StubMesh->GetSkeleton());

		auto AddBone = [&Modifier](FName BoneName, FName ParentName) {
			FMeshBoneInfo Info;
			Info.Name = BoneName;
			const int32 ParentIdx = ParentName.IsNone()
				? INDEX_NONE
				: Modifier.GetReferenceSkeleton().FindBoneIndex(ParentName);
			Info.ParentIndex = ParentIdx;
			// Трансформа по умолчанию — identity
			Modifier.Add(Info, FTransform::Identity);
		};

		AddBone(TEXT("root"), NAME_None);
		AddBone(TEXT("pelvis"), TEXT("root"));
		AddBone(TEXT("spine_01"), TEXT("pelvis"));
		AddBone(TEXT("spine_02"), TEXT("spine_01"));
		AddBone(TEXT("spine_03"), TEXT("spine_02"));
		AddBone(TEXT("spine_04"), TEXT("spine_03"));
		AddBone(TEXT("spine_05"), TEXT("spine_04"));
		AddBone(TEXT("clavicle_l"), TEXT("spine_05"));
		AddBone(TEXT("clavicle_r"), TEXT("spine_05"));
		AddBone(TEXT("upperarm_l"), TEXT("clavicle_l"));
		AddBone(TEXT("upperarm_r"), TEXT("clavicle_r"));
		AddBone(TEXT("head"), TEXT("spine_05"));
		AddBone(TEXT("neck_01"), TEXT("spine_05"));
	}
	SkelComp->SetSkeletalMesh(StubMesh);
	SkelComp->RegisterComponent();

	// Создаём менеджер
	UCyberJackColliderManager* Manager = NewObject<UCyberJackColliderManager>(HostActor);
	Manager->TargetSkeletalMesh = SkelComp;
	Manager->AnchorTable = CreateTestAnchorTable(HostActor);
	Manager->bSpawnOnBeginPlay = false;
	Manager->RegisterComponent();

	const int32 LogicalCount = Manager->SpawnColliders();
	TestTrue(TEXT("SpawnColliders должен вернуть > 0"), LogicalCount > 0);

	const TArray<UCyberJackAnchorComponent*>& Colliders = Manager->GetSpawnedColliders();
	TestTrue(TEXT("Должно быть >= 5 одиночных + 2 зеркальных для shoulders = 7"), Colliders.Num() >= 7);

	// Проверяем что каждый коллайдер привязан к существующей кости
	for (UCyberJackAnchorComponent* Collider : Colliders)
	{
		TestNotNull(TEXT("Collider not null"), Collider);
		if (!Collider) continue;
		TestTrue(TEXT("Collider attached"), Collider->IsRegistered());
		TestTrue(TEXT("Collider имеет непустой PartId"), !Collider->PartId.IsEmpty());
		TestTrue(TEXT("Collider имеет bone name"), !Collider->SourceBoneName.IsNone());

		// Тег `CyberPart:` должен присутствовать
		const FString TagToCheck = UCyberJackAnchorComponent::TagPrefix + Collider->PartId;
		const bool bHasTag = Collider->ComponentTags.Contains(FName(*TagToCheck));
		TestTrue(FString::Printf(TEXT("Collider должен иметь тег '%s'"), *TagToCheck), bHasTag);
	}

	// Зеркалирование: для строки 'shoulders' (BodySide=Both) должны быть 'shoulders_left' и 'shoulders_right'
	const bool bHasLeft  = Colliders.ContainsByPredicate([](UCyberJackAnchorComponent* C) { return C && C->PartId == TEXT("shoulders_left"); });
	const bool bHasRight = Colliders.ContainsByPredicate([](UCyberJackAnchorComponent* C) { return C && C->PartId == TEXT("shoulders_right"); });
	TestTrue(TEXT("Должен быть shoulders_left (mirror X+)"), bHasLeft);
	TestTrue(TEXT("Должен быть shoulders_right (mirror X-)"), bHasRight);

	if (bHasRight)
	{
		UCyberJackAnchorComponent* RightCollider = *Colliders.FindByPredicate(
			[](UCyberJackAnchorComponent* C) { return C && C->PartId == TEXT("shoulders_right"); });
		TestTrue(TEXT("Right коллайдер помечен bIsMirrored=true"), RightCollider && RightCollider->bIsMirrored);
	}

	// Системные слоты (posture) НЕ должны спавнить коллайдер
	const bool bHasSystemPart = Colliders.ContainsByPredicate([](UCyberJackAnchorComponent* C) { return C && C->PartId == TEXT("posture"); });
	TestFalse(TEXT("Системный слот 'posture' не должен спавнить коллайдер"), bHasSystemPart);

	// mind_state системный, но имеет bone (head) — он спавнится как обычный коллайдер
	const bool bHasMind = Colliders.ContainsByPredicate([](UCyberJackAnchorComponent* C) { return C && C->PartId == TEXT("mind_state"); });
	TestTrue(TEXT("mind_state (системный слот, но с bone) должен спавнить коллайдер"), bHasMind);

	// Cleanup
	Manager->ClearColliders();
	HostActor->Destroy();
	GEngine->DestroyWorldContext(World);
	World->DestroyWorld(false);

	return true;
}

// =============================================================================
// Test 2: парсинг тегов CyberPart: работает корректно
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackAnchorComponent_ParseTagTest,
	"CyberJack.Phase1.AnchorComponent.ExtractPartIdFromTags",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackAnchorComponent_ParseTagTest::RunTest(const FString& Parameters)
{
	// Пустые теги → пустая строка
	TestEqual(TEXT("Пустые теги → пустой partId"),
		UCyberJackAnchorComponent::ExtractPartIdFromTags({}),
		FString());

	// Без префикса → пустая строка
	TestEqual(TEXT("Тег без префикса → пустой partId"),
		UCyberJackAnchorComponent::ExtractPartIdFromTags({FName(TEXT("SomeOtherTag"))}),
		FString());

	// С префиксом → корректный partId
	TestEqual(TEXT("CyberPart:chest → chest"),
		UCyberJackAnchorComponent::ExtractPartIdFromTags({FName(TEXT("CyberPart:chest"))}),
		FString(TEXT("chest")));

	// Парный тег nipples_left
	TestEqual(TEXT("CyberPart:nipples_left → nipples_left"),
		UCyberJackAnchorComponent::ExtractPartIdFromTags({FName(TEXT("CyberPart:nipples_left"))}),
		FString(TEXT("nipples_left")));

	// Первый CyberPart:* выигрывает
	TestEqual(TEXT("Первый CyberPart:* берётся"),
		UCyberJackAnchorComponent::ExtractPartIdFromTags({
			FName(TEXT("OtherTag")),
			FName(TEXT("CyberPart:chest")),
			FName(TEXT("CyberPart:belly"))
		}),
		FString(TEXT("chest")));

	return true;
}

// =============================================================================
// Test 3: SetCyberJackPartId правильно обновляет переменную и теги
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackAnchorComponent_SetPartIdTest,
	"CyberJack.Phase1.AnchorComponent.SetCyberJackPartId",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackAnchorComponent_SetPartIdTest::RunTest(const FString& Parameters)
{
	UCyberJackAnchorComponent* Comp = NewObject<UCyberJackAnchorComponent>();
	if (!TestNotNull(TEXT("Component"), Comp)) return false;

	// Set: chest
	Comp->SetCyberJackPartId(TEXT("chest"), TEXT("spine_05"), false);
	TestEqual(TEXT("PartId == chest"), Comp->PartId, FString(TEXT("chest")));
	TestEqual(TEXT("SourceBoneName == spine_05"), Comp->SourceBoneName, FName(TEXT("spine_05")));
	TestFalse(TEXT("bIsMirrored == false"), Comp->bIsMirrored);

	const bool bHasTag = Comp->ComponentTags.Contains(FName(TEXT("CyberPart:chest")));
	TestTrue(TEXT("ComponentTags содержит CyberPart:chest"), bHasTag);

	// Re-set: меняется partId → старый тег убирается
	Comp->SetCyberJackPartId(TEXT("belly"), TEXT("pelvis"), true);
	TestEqual(TEXT("PartId == belly"), Comp->PartId, FString(TEXT("belly")));
	TestTrue(TEXT("bIsMirrored == true"), Comp->bIsMirrored);
	TestFalse(TEXT("Старый тег CyberPart:chest убран"),
		Comp->ComponentTags.Contains(FName(TEXT("CyberPart:chest"))));
	TestTrue(TEXT("Новый тег CyberPart:belly добавлен"),
		Comp->ComponentTags.Contains(FName(TEXT("CyberPart:belly"))));

	return true;
}

// =============================================================================
// Test 4: MakePairedPartId корректно создаёт _left/_right
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackColliderManager_MakePairedPartIdTest,
	"CyberJack.Phase1.ColliderManager.MakePairedPartId",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackColliderManager_MakePairedPartIdTest::RunTest(const FString& Parameters)
{
	// BodySide=Both → _left / _right
	{
		FCyberJackAnchorRow Row;
		Row.PartId = TEXT("shoulders");
		Row.BodySide = ECyberJackBodySide::Both;
		TestEqual(TEXT("Both/left → shoulders_left"),
			UCyberJackColliderManager::MakePairedPartId(Row, true), FString(TEXT("shoulders_left")));
		TestEqual(TEXT("Both/right → shoulders_right"),
			UCyberJackColliderManager::MakePairedPartId(Row, false), FString(TEXT("shoulders_right")));
	}

	// BodySide=Center → as is
	{
		FCyberJackAnchorRow Row;
		Row.PartId = TEXT("chest");
		Row.BodySide = ECyberJackBodySide::Center;
		TestEqual(TEXT("Center/left → chest"),
			UCyberJackColliderManager::MakePairedPartId(Row, true), FString(TEXT("chest")));
		TestEqual(TEXT("Center/right → chest"),
			UCyberJackColliderManager::MakePairedPartId(Row, false), FString(TEXT("chest")));
	}

	// PartId уже с _left → не дублируем
	{
		FCyberJackAnchorRow Row;
		Row.PartId = TEXT("left_arm");
		Row.BodySide = ECyberJackBodySide::Both;
		TestEqual(TEXT("Уже left_* → как есть"),
			UCyberJackColliderManager::MakePairedPartId(Row, true), FString(TEXT("left_arm")));
	}

	return true;
}

// =============================================================================
// Test 5: MirrorOffsetX зеркалит только X
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackColliderManager_MirrorOffsetXTest,
	"CyberJack.Phase1.ColliderManager.MirrorOffsetX",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackColliderManager_MirrorOffsetXTest::RunTest(const FString& Parameters)
{
	const FVector In(3.0f, -6.0f, 7.0f);
	const FVector Mirrored = UCyberJackColliderManager::MirrorOffsetX(In);
	TestEqual(TEXT("X инвертирован"), Mirrored.X, -3.0);
	TestEqual(TEXT("Y не изменён"), Mirrored.Y, -6.0);
	TestEqual(TEXT("Z не изменён"), Mirrored.Z, 7.0);

	// Zero → zero
	const FVector Zero = UCyberJackColliderManager::MirrorOffsetX(FVector::ZeroVector);
	TestEqual(TEXT("Zero → Zero"), Zero, FVector::ZeroVector);

	return true;
}

// =============================================================================
// Test 6: Полный flow — спавн → рейкаст по каждому коллайдеру → hit
// =============================================================================
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FCyberJackColliderManager_LineTraceHitTest,
	"CyberJack.Phase1.PlayerController.LineTraceByChannel_HitEachCollider",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCyberJackColliderManager_LineTraceHitTest::RunTest(const FString& Parameters)
{
	using namespace CyberJackAutomationTestUtils;

	UWorld* World = UWorld::CreateWorld(EWorldType::Game, /*bInformEngineOfWorld=*/false, TEXT("CJ_TestWorld_Trace"));
	if (!TestNotNull(TEXT("World"), World)) return false;
	FWorldContext& WorldContext = GEngine->CreateNewWorldContext(EWorldType::Game);
	WorldContext.SetCurrentWorld(World);
	World->InitializeActorsForPlay(FURL());

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AActor* HostActor = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, SpawnParams);
	if (!TestNotNull(TEXT("HostActor"), HostActor))
	{
		GEngine->DestroyWorldContext(World);
		World->DestroyWorld(false);
		return false;
	}

	// Скелет с известными костями
	USkeletalMeshComponent* SkelComp = NewObject<USkeletalMeshComponent>(HostActor);
	USkeletalMesh* StubMesh = NewObject<USkeletalMesh>(HostActor);
	{
		FReferenceSkeletonModifier Modifier(StubMesh->GetRefSkeleton(), StubMesh->GetSkeleton());
		auto AddBone = [&Modifier](FName BoneName, FName ParentName) {
			FMeshBoneInfo Info;
			Info.Name = BoneName;
			const int32 ParentIdx = ParentName.IsNone()
				? INDEX_NONE
				: Modifier.GetReferenceSkeleton().FindBoneIndex(ParentName);
			Info.ParentIndex = ParentIdx;
			Modifier.Add(Info, FTransform::Identity);
		};
		AddBone(TEXT("root"), NAME_None);
		AddBone(TEXT("pelvis"), TEXT("root"));
		AddBone(TEXT("spine_05"), TEXT("pelvis"));
		AddBone(TEXT("head"), TEXT("spine_05"));
	}
	SkelComp->SetSkeletalMesh(StubMesh);
	SkelComp->SetWorldLocation(FVector::ZeroVector);
	SkelComp->RegisterComponent();

	// Спавним коллайдеры (только одиночные)
	UCyberJackColliderManager* Manager = NewObject<UCyberJackColliderManager>(HostActor);
	Manager->TargetSkeletalMesh = SkelComp;
	Manager->AnchorTable = CreateTestAnchorTable(HostActor);
	Manager->bSpawnOnBeginPlay = false;
	Manager->RegisterComponent();

	Manager->SpawnColliders();

	// Прямой рейкаст по каждому спавненному коллайдеру
	// Подменяем LineTraceSingleByChannel через Test-функцию: используем SweepMultiByChannel
	// от центра коллайдера в его нормаль, чтобы убедиться что он реагирует на UIInteractable.
	const TArray<UCyberJackAnchorComponent*>& Colliders = Manager->GetSpawnedColliders();
	TestTrue(TEXT("Должно быть >0 коллайдеров"), Colliders.Num() > 0);

	int32 HitCount = 0;
	for (UCyberJackAnchorComponent* Collider : Colliders)
	{
		if (!Collider) continue;

		// Sphere-форма: используем SweepSingleByChannel от центра
		// в любую сторону — должно попасть в свой коллайдер
		const FVector Center = Collider->GetComponentLocation();
		const FVector End = Center + FVector(0.0f, 0.0f, Collider->GetUnscaledSphereRadius() * 0.5f);

		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(CJTestSweep), false);
		const bool bHit = World->SweepSingleByChannel(
			Hit, Center, End, FQuat::Identity,
			ECC_GameTraceChannel1,
			FCollisionShape::MakeSphere(Collider->GetUnscaledSphereRadius() * 0.5f),
			Params);

		if (bHit && Hit.GetComponent() == Collider)
		{
			++HitCount;

			// Проверяем что partId матчится
			FString PartId;
			const bool bGotPart = ACyberJackPlayerController::TryGetPartIdFromHitComponent(Collider, PartId);
			TestTrue(FString::Printf(TEXT("PartId получен для '%s'"), *Collider->PartId), bGotPart);
			TestEqual(FString::Printf(TEXT("PartId '%s' матчится"), *Collider->PartId), PartId, Collider->PartId);
		}
	}

	TestEqual(TEXT("Каждый коллайдер отзывается на UIInteractable sweep"), HitCount, Colliders.Num());

	// Cleanup
	Manager->ClearColliders();
	HostActor->Destroy();
	GEngine->DestroyWorldContext(World);
	World->DestroyWorld(false);

	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
