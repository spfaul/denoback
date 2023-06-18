# denoback
A Party Game about Teleporting Karate Dinos, who shoot bullets sometimes.

Inspired by [Super Smash Bros](https://www.smashbros.com/en_US/index.html), [Brawlhalla](https://www.brawlhalla.com/) and other platformer-fighting style video games.

# Rules
## Controls
Movement: <kbd>A</kbd><kbd>D</kbd>

(Double) Jump: <kbd>Space</kbd>

Right Click: **Punch**

Left Click: **Teleport**

## Win condition
Each dino gets 3 lives. A dino dies if they reach 0 lives. The winner is the last remaining dino alive.

## The Teleport Mechanic (i.e. "Backspace")
The theme of the game was supposed to be **"Backspace"**. It manifests itself as a teleport mechanic, which allows a dino to return to its previous position roughly ~5s ago.

The "Backspace" teleport cooldown has a 10s cooldown. 

A Player's own teleport destination is shown as a small translucent **blue** circle. 
Other players' teleport destinations are drawn as **red** circles.

Q: Does the whole game revolve around the **Backspace** mechanic teleports?
> No, but you can watch virtual tiny teleporting karate dinosaurs throw flying kicks and shit at each other. Reasonable tradeoff, no?

## Danger
Danger% indicates the amount of knockback a dino takes from a hit. Every dino starts at 10% Danger, however the Danger% grows exponentially with every hit.
Danger% is capped at 500% (1 hit K/O).

## Events
Game events can randomly trigger (est. every ~1min) which change the pace of the game.
There are currently 2 events:
- Sudden Death - All alive dinos temporarily go to 1 life.
- Bullet Hell - All alive dinos can shoot high-speed "bullets" by right-clicking to knock other dinos off the map
