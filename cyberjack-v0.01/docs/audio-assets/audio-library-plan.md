# Action and reaction audio library

Audio is split into two independently selected layers:

1. `action` — objective Foley/device sound selected by `actionId`;
2. `reaction` — a nonverbal character vocalization selected by character voice,
   portrait emotion, intensity, and result.

This keeps an action reusable and prevents a generated reaction from implying a
specific appraisal that the simulation did not produce.

### Contact-sound rule

Every action that physically touches the character must have an audible organic
contact component. The base prompt must explicitly name `soft human skin`,
`skin-on-skin`, `fleshy/organic body resonance`, or the relevant combination of
skin with fabric/equipment. Avoid ambiguous phrases such as `sharp impact` on
their own: sound generation models may interpret them as wood or another rigid
surface.

Use these layers where applicable:

- direct touch: skin texture + soft body resonance;
- clothing: fabric movement + muffled contact with the body underneath;
- restraint/equipment: buckle, latch, or motor + a quieter skin-pressure layer;
- clinical actions: tool sound + glove/skin contact;
- intimate contact: restrained organic skin contact without unrelated hard
  transients.

Explicitly exclude `wood`, `table`, `metal impact`, `hard object`, and `rigid
surface` from prompts for direct body impacts.

## Action atoms and mappings

`silent` means that adding a dedicated sound would be distracting; a reaction
may still play.

| Actions | Audio atom |
| --- | --- |
| `act_slap` | `impact/skin_slap` |
| `act_punch` | `impact/body_thud` |
| `act_kiss` | `contact/kiss_soft` |
| `act_caress` | `contact/skin_stroke` |
| `act_interrogate`, `act_praise` | `silent` (spoken dialogue owns the sound) |
| `act_examine` | `clinical/glove_touch` |
| `act_apply_handcuffs`, `act_apply_ankle_cuffs` | `restraint/cuffs_close` |
| `act_remove_handcuffs`, `act_remove_ankle_cuffs` | `restraint/cuffs_open` |
| `act_struggle_cuffs` | `restraint/chain_struggle` |
| `act_apply_collar` | `restraint/collar_latch` |
| `act_remove_collar` | `restraint/collar_unlatch` |
| `act_shock_collar` | `device/electric_snap` |
| `act_connect_tens` | `device/electrode_attach` |
| `act_start_electrostimulation` | `device/electro_start` |
| `act_adjust_electrostimulation` | `device/electro_step_up` |
| `act_stop_electrostimulation` | `device/electro_stop` |
| `act_disconnect_tens` | `device/electrode_remove` |
| `act_inject_truth_serum`, `act_inject_painkiller` | `clinical/injection` |
| `act_insert_plug` | `contact/soft_insertion` |
| `act_remove_plug` | `contact/soft_removal` |
| `act_activate_plug`, `act_start_vibrator` | `device/vibration_start` + sustained `device/vibration_loop` |
| `act_adjust_vibration` | `device/vibration_step_up` |
| `act_deactivate_plug`, `act_stop_vibrator` | `device/vibration_stop` |
| `pose_standing`, `pose_sitting`, `pose_lying_down` | `movement/body_reposition` with surface variants |
| `pose_all_fours`, `pose_spread_eagle` | `movement/body_reposition_extended` |
| `act_hold_exposure`, `act_present_feet` | `movement/presentation_shift` |
| `act_end_exposure`, `act_end_feet_presentation` | `movement/relax_pose` |
| `eq_blindfold_apply` | `fabric/blindfold_tie` |
| `eq_blindfold_remove` | `fabric/blindfold_remove` |
| `eq_gag_apply` | `restraint/gag_buckle` |
| `eq_gag_remove` | `restraint/gag_unbuckle` |
| `act_suspend_wrists` | `restraint/rope_tension` |
| `act_release_wrists` | `restraint/rope_release` |
| `eq_clothe_jumpsuit`, `eq_clothe_dress`, `eq_clothe_lab_gown`, `eq_clothe_calibration_set` | `clothing/dress_rustle` |
| `eq_clothe_stockings` | `clothing/stockings_on` |
| `eq_clothe_underwear`, `eq_clothe_panties` | `clothing/underwear_on` |
| all `eq_clothe_*_remove` actions | matching `clothing/*_off` atom |
| `act_apply_restraint_belt` | `restraint/belt_ratchet` |
| `act_remove_restraint_belt` | `restraint/belt_release` |
| `finger_insertion` | `contact/manual_insertion` |
| `act_start_penetration` | `contact/penetration_start` |
| `act_increase_friction` | `contact/rhythm_step_up` |
| `act_decrease_friction` | `contact/rhythm_step_down` |
| `act_sexual_climax` | `transition/discharge` |
| `act_end_sexual_contact` | `contact/intimate_stop` |

Continuous atoms (`vibration_loop`, electro stimulation, rhythmic contact) must
be seamless loops. Start and stop atoms are one-shots. Loops should be driven by
active contexts, not replayed on every simulation tick.

## Reaction atoms

Each character gets a stable voice identity. The prompt wording for that
identity must remain unchanged between generations:

| Character | Voice identity |
| --- | --- |
| Nika | young adult woman, low warm restrained voice |
| Mira | adult woman, bright soft airy voice |
| Iona | adult woman, cool deeper authoritative voice |

Recommended variants per character:

| State / portrait emotion | Variants | Vocal atoms |
| --- | ---: | --- |
| `neutral`, `curious` | 2 | quiet inhale, attentive hum |
| `guarded`, `defiant`, `angry`, `disgust` | 3 | guarded breath catch, defiant grunt, irritated exhale |
| `surprise`, `fear`, `distressed`, `high_negative` | 3 | gasp, whimper, sharp frightened inhale |
| `pain`, `crying` | 4 | breath hiss, short cry, strained groan, shaky exhale |
| `receptive`, `smile`, `shy`, `blush` | 3 | soft pleased breath, shy gasp, warm hum |
| `aroused`, `pleasure`, `high_positive` | 4 | breathy sigh, restrained moan, stronger moan, trembling exhale |
| `mixed`, `mixed_overload` | 3 | conflicted gasp, broken moan, overwhelmed breath |
| `submissive`, `subspace` | 3 | yielding sigh, distant soft moan, slow unfocused breathing |
| `climax` | 4 | rising gasp, involuntary cry, peak moan, after-breath |
| `exhausted`, `sleepy`, `afterglow` | 3 | tired exhale, relieved sigh, slow settling breath |
| `bored` | 2 | flat nasal exhale, impatient sigh |
| `unconscious` | 1 | quiet breathing loop; no event reaction |

Selection rules:

- use reaction intensity tiers `low`, `medium`, `high`;
- never select a positive vocalization solely from the action type;
- use appraisal/result and resolved portrait emotion;
- prevent the same variant from repeating twice in a row;
- reactions play with a 40–120 ms delay after impact, but device start sounds
  play before the reaction;
- normalize action and reaction separately, then duck action Foley by 2–4 dB
  while a vocal reaction is active.

## Generated pilot set

| File | Layer | Intended atom |
| --- | --- | --- |
| `actions/act_slap_01.mp3` | action | `impact/skin_slap`, concise scene prompt |
| `actions/act_slap_02.mp3` | action candidate | `impact/skin_slap`, explicit palm-to-cheek scene |
| `actions/act_slap_03.mp3` | action candidate | `impact/skin_slap`, close Foley scene |
| `actions/act_apply_handcuffs_01.mp3` | action | `restraint/cuffs_close` |
| `actions/act_shock_collar_01.mp3` | action | `device/electric_snap` |
| `actions/act_start_vibrator_loop_01.mp3` | action | `device/vibration_start/loop` pilot |
| `actions/act_start_vibrator_loop_02.mp3` | action candidate | low three-pulse vibration loop |
| `actions/act_start_vibrator_loop_03.mp3` | action candidate | medium-low two-short/one-long vibration loop |
| `actions/act_start_vibrator_loop_04.mp3` | action candidate | Hitachi Magic Wand, three-pulse loop |
| `actions/act_start_vibrator_loop_05.mp3` | action candidate | clitoral vibrator, three-pulse loop |
| `actions/act_start_vibrator_loop_06.mp3` | selected action | massage vibrator, two-short/one-long loop |
| `actions/act_slap_04.mp3` | experiment | concise face-slap prompt, low influence, take A |
| `actions/act_slap_05.mp3` | experiment | concise face-slap prompt, low influence, take B |
| `actions/act_slap_06.mp3` | experiment | bare-skin one-shot Foley |
| `actions/act_slap_07.mp3` | preferred experiment | close-up cheek-slap scene; clearest transient on spectral review |
| `actions/act_slap_08.mp3` | experiment | spanking one-shot |
| `actions/act_slap_09.mp3` | experiment | professional Foley wording |
| `actions/act_inject_01.mp3` | action | `clinical/injection` |
| `reactions/nika_guarded_gasp_01.mp3` | reaction | Nika / guarded / low |
| `reactions/nika_pain_cry_01.mp3` | reaction | Nika / pain / medium |
| `reactions/mira_pleasure_moan_01.mp3` | reaction | Mira / pleasure / medium |
| `reactions/mira_fear_whimper_01.mp3` | reaction | Mira / fear / low |
| `reactions/iona_defiant_grunt_01.mp3` | reaction | Iona / defiant / low |

Pilot files are stored under `public/audio/`.
