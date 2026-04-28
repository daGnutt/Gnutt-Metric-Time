# Gnutt Metric Time
Gnutt Metric time is a fictious time system and this project is a gnome extension
that shows the current GMT in the Gnome top bar.

## How does it work
It represents date and time by doing astronomical calculations,
and currently has some enforced thinking. It requires to be used on a planet
with an off axis tilt (such as Earth), and the planet needs to have a
non-tidal-locked rotation speed to its star. The idea is to have a time system
that is useful for humans that lives by a day and night cycle.

## Usage on Earth (most relevant)
We first need to decide a northern and southern hemisphere on the planet. Which
is already done for us. Then we must have a year 0. In extra-terrestial planets
we can use the discovery year for year 0. year numbers can of course go
negative for when we need to reference a timestamp in the past). In our case, we
do not know when the Earth was discoverd. So lets just steal the current
Gregorian Year (in time of writing 2026).

Start of Year is calculated to be the middle of the longest night (midpoint between sunset and sunrise) of the year
in the northern hemispehere at longitude 0 and latitude 45. So for us it would be 2025-12-22
00:00:30 as the start of the new year. This would be represented by 2026:0.0

Next we calculate the middle of the next night (time between sundown and sunup)
and the part of the timestamp that is after the "." is the fraction of days
between these two times.

So we have YYYY:DDD.FFF where YYYY are the year, DDD is completed days (0-based index) and FFF
are the fraction of the day (calculated from midpoint between last sunset/sunrise and next midpoint between next sunset/sunrise).
Fractions can be expanded down to as low values as needed for correct time measurement, but for human scales rarely more than 3
decimals are needed.
