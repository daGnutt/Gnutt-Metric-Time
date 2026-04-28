# Gnutt Metric Time

Gnutt Metric Time is a fictitious time system and this project is a
gnome extension that shows the current Gnutt Metric Time (GMT) in the
Gnome top bar.

Note: Throughout this README, "GMT" refers to the project name
"Gnutt Metric Time" — not Greenwich Mean Time.

## How does it work

It represents date and time by doing astronomical calculations, and
currently has some constraints and assumptions. It requires a planet
with an off-axis tilt (such as Earth) and a non-tidally-locked rotation
about its star. The idea is to have a time system useful for humans who
live by a day and night cycle.

Sunrise/sunset are computed from astronomical algorithms (solar center
crossing the geometric horizon), corrected for refraction and observer
elevation. This system does not use timezones; all times are computed
relative to longitude 0 and latitude 45.

For reproducibility the NOAA Solar Position Algorithm (SPA) or
equivalent ephemeris is used (or libraries such as 'astral'). Twilight
type = geometric (sun center at horizon).

## Usage on Earth (most relevant)

We first need to decide a northern and southern hemisphere on the
planet, which is already done for us. Then we must have a year 0. On
extraterrestrial planets we can use the discovery year for year 0.
Year numbers can of course go negative for timestamps in the past. In
our case, we do not know when the Earth was discovered, so let's just
use the current Gregorian year (at time of writing: 2026).

Start of Year is calculated to be the middle of the longest night
(midpoint between sunset and sunrise) of the year in the northern
hemisphere at longitude 0 and latitude 45. So for us it would be
2025-12-22 00:00:30 as the start of the new year. This would be
represented by 2026:0.0

Next we calculate the middle of the next night (time between sundown and
sunup) and the part of the timestamp after the "." is the fraction of
days between these two times.

So we have YYYY:DDD.FFF where YYYY are the year, DDD is completed days
(0-based index) and FFF are the fraction of the day (calculated from the
midpoint between the previous sunset/sunrise and the next midpoint
between the next sunset/sunrise). Fractions can be expanded down to as
low values as needed for correct time measurement, but for human scales
rarely more than 3 decimals are needed.
