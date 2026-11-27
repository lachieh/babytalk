// The two side buttons. BOOT goes back to the station's first page from anywhere in the station;
// PWR turns the screen off and on (the AXP2101's own long press still cuts power).
#pragma once

void buttons_start(void);
/** Brightness for the current theme: full by day, low at night. */
void buttons_apply_brightness(void);
