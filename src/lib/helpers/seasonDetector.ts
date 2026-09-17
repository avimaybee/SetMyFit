/**
 * Season Detection Utility
 * 
 * Determines the current season based on date and hemisphere.
 * This is crucial for outfit recommendations when weather temperature
 * doesn't match typical seasonal expectations (e.g., warm day in late autumn).
 */

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

/**
 * Determine the current season based on date and latitude
 * @param date - The date to check (defaults to current date)
 * @param latitude - Latitude to determine hemisphere (positive = Northern, negative = Southern)
 * @returns The current season
 */
export function getCurrentSeason(date: Date = new Date(), latitude: number = 0): Season {
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31
  
  // Determine hemisphere
  const isNorthernHemisphere = latitude >= 0;
  
  // Define season boundaries (approximate dates)
  // Northern Hemisphere:
  // Spring: March 20 - June 20
  // Summer: June 21 - September 22
  // Autumn: September 23 - December 20
  // Winter: December 21 - March 19
  
  let season: Season;
  
  if (isNorthernHemisphere) {
    if (month === 2 && day >= 20 || month === 3 || month === 4 || month === 5 && day <= 20) {
      season = 'Spring';
    } else if (month === 5 && day >= 21 || month === 6 || month === 7 || month === 8 && day <= 22) {
      season = 'Summer';
    } else if (month === 8 && day >= 23 || month === 9 || month === 10 || month === 11 && day <= 20) {
      season = 'Autumn';
    } else {
      season = 'Winter';
    }
  } else {
    // Southern Hemisphere - seasons are reversed
    if (month === 2 && day >= 20 || month === 3 || month === 4 || month === 5 && day <= 20) {
      season = 'Autumn';
    } else if (month === 5 && day >= 21 || month === 6 || month === 7 || month === 8 && day <= 22) {
      season = 'Winter';
    } else if (month === 8 && day >= 23 || month === 9 || month === 10 || month === 11 && day <= 20) {
      season = 'Spring';
    } else {
      season = 'Summer';
    }
  }
  
  return season;
}

/**
 * Get a descriptive string about the current season
 * @param season - The season
 * @param month - The current month (0-11)
 * @returns A descriptive string
 */
export function getSeasonDescription(season: Season, month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const descriptions: Record<Season, Record<string, string>> = {
    Spring: {
      early: 'early spring (transitioning from winter)',
      mid: 'mid-spring (moderate temperatures)',
      late: 'late spring (warming up, approaching summer)'
    },
    Summer: {
      early: 'early summer (warm, sunny days)',
      mid: 'mid-summer (peak heat)',
      late: 'late summer (still warm but transitioning to autumn)'
    },
    Autumn: {
      early: 'early autumn (mild, comfortable temperatures)',
      mid: 'mid-autumn (cooler, crisp weather)',
      late: 'late autumn (cold, approaching winter)'
    },
    Winter: {
      early: 'early winter (cold, short days)',
      mid: 'mid-winter (coldest period)',
      late: 'late winter (still cold but approaching spring)'
    }
  };
  
  // Determine if early, mid, or late season based on month
  let period: 'early' | 'mid' | 'late' = 'mid';
  
  if (season === 'Spring') {
    if (month === 2) period = 'early';
    else if (month === 4 || month === 5) period = 'late';
  } else if (season === 'Summer') {
    if (month === 5) period = 'early';
    else if (month === 8) period = 'late';
  } else if (season === 'Autumn') {
    if (month === 8 || month === 9) period = 'early';
    else if (month === 11) period = 'late';
  } else if (season === 'Winter') {
    if (month === 11 || month === 0) period = 'early';
    else if (month === 2) period = 'late';
  }
  
  return `${monthNames[month]}, ${descriptions[season][period]}`;
}
