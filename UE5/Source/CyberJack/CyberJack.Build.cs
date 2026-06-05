// Copyright 2026 CyberJack. All rights reserved.

using UnrealBuildTool;

public class CyberJack : ModuleRules
{
	public CyberJack(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.AddRange(new string[] { });
		PrivateIncludePaths.AddRange(new string[] { });

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"AIModule",
			"NavigationSystem"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore",
			"UnrealEd"
		});

		// AutomationController нужен для FAutomationTestBase тестов (только в Editor)
		if (Target.Type == TargetType.Editor)
		{
			PrivateDependencyModuleNames.Add("AutomationController");
		}
	}
}
