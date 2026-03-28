; NousAI — HUION K20 KeyDial Mini Simulator
; Simulates K20 hardware keypresses for testing without physical device
;
; Usage: Install AutoHotkey v2 → double-click this script → use hotkeys below
; Download: https://autohotkey.com
;
; The K20 sends F13-F24 keys + dial rotation events.
; This script maps easy-to-reach keys to simulate those inputs.

#Requires AutoHotkey v2.0
#SingleInstance Force

; ─── K20 Button Simulation ───────────────────────────────────
; Ctrl+Numpad maps to K20 buttons (F13-F24)

^Numpad1::Send("{F13}")   ; K20 Button 1 → FSRS Grade 1 (Again)
^Numpad2::Send("{F14}")   ; K20 Button 2 → FSRS Grade 2 (Hard)
^Numpad3::Send("{F15}")   ; K20 Button 3 → FSRS Grade 3 (Good)
^Numpad4::Send("{F16}")   ; K20 Button 4 → FSRS Grade 4 (Easy)
^Numpad5::Send("{F17}")   ; K20 Button 5 → Next card / Skip
^Numpad6::Send("{F18}")   ; K20 Button 6 → Flip card
^Numpad7::Send("{F19}")   ; K20 Button 7 → AI mode toggle
^Numpad8::Send("{F20}")   ; K20 Button 8 → Omni start
^Numpad9::Send("{F21}")   ; K20 Button 9 → Focus lock
^Numpad0::Send("{F22}")   ; K20 Button 10 → Timer toggle

; ─── K20 Dial Simulation ─────────────────────────────────────
; Ctrl+Scroll simulates dial rotation (zoom/cycle navigation)

^WheelUp::Send("{F23}")   ; Dial clockwise → Zoom in / Next cycle
^WheelDown::Send("{F24}") ; Dial counter-clockwise → Zoom out / Prev cycle

; ─── Escape Priority Queue ───────────────────────────────────
; K20's top button is mapped to Escape with priority
^Numpad.::Send("{Escape}") ; K20 Escape → Close modal / Exit tool

; ─── Status Indicator ────────────────────────────────────────
; Shows a tooltip when the script is active

TraySetIcon("Shell32.dll", 44)
A_IconTip := "NousAI K20 Simulator Active"

; Show activation notification
ToolTip("K20 Simulator Active`nCtrl+Numpad = K20 Buttons`nCtrl+Scroll = Dial")
SetTimer(() => ToolTip(), -3000)

; ─── Help ─────────────────────────────────────────────────────
; Ctrl+F12 shows the key map

^F12:: {
    help := "
    (
    NousAI K20 Simulator — Key Map

    Ctrl+Numpad1  →  F13  (FSRS: Again)
    Ctrl+Numpad2  →  F14  (FSRS: Hard)
    Ctrl+Numpad3  →  F15  (FSRS: Good)
    Ctrl+Numpad4  →  F16  (FSRS: Easy)
    Ctrl+Numpad5  →  F17  (Next/Skip)
    Ctrl+Numpad6  →  F18  (Flip card)
    Ctrl+Numpad7  →  F19  (AI mode)
    Ctrl+Numpad8  →  F20  (Omni start)
    Ctrl+Numpad9  →  F21  (Focus lock)
    Ctrl+Numpad0  →  F22  (Timer)
    Ctrl+ScrollUp →  F23  (Dial CW)
    Ctrl+ScrollDn →  F24  (Dial CCW)
    Ctrl+Numpad.  →  Esc  (Exit)
    Ctrl+F12      →  This help
    )"
    MsgBox(help, "K20 Simulator", "T10")
}
