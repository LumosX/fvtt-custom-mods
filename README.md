Macros and scripts for FoundryVTT, namely to extend the Pathfinder 1e system.

I may convert these (read: Custom Conditions) to real modules at some point, if the fancy takes me.


## Custom Conditions 

![](Custom%20Conditions/img/cc_studied_target.gif)


[Find out more](Custom%20Conditions/README.md)

Macro + world script to allow players to add and remove status conditions and custom buffs to/from tokens. It's really quite useful.

* Allows players to affect any targetable tokens with status conditions and custom buffs (provided a GM is present)
* Supports custom condition buff items with levels and durations
* Can override levels and durations on the fly, letting you reapply conditions, or worsen or ameliorate them on specific targets


## Extra Change Targets

[Find out more](Extra%20Change%20Targets/README.md)

Clumsily adds extra change targets to actors. These are related to CMB and CMD for combat manoeuvres, as well as effective size category increases. None are used internally by the system, so this script is of rather limited usefulness.



## Running these
Copy-paste all scripts as script macros in Foundry, and save them. The use the [FVTT Advanced Macros](https://github.com/mclemente/fvtt-advanced-macros) module (or any suitable replacement, I guess) to execute `CustomCondManager` and `ExtraChangeTargets` as world scripts.
