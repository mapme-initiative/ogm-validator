/* eslint-disable  @typescript-eslint/no-explicit-any */
export const excelDateToString = (excelDate: number): string => {
    try {
        // Excel dates are serialized as days from January 1, 1900, but Excel considers 1900 a leap year
        const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
        const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000); // Adjust for days
        return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } catch (error) {
        return "" + excelDate;
    }
};
export const safeParseFloat = (unsafeFloatString: string): number => {
    try {
        return parseFloat(unsafeFloatString)
    } catch (error) {
        return NaN
    }
};
export const safeParseInt = (unsafeFloatString: string): number => {
    try {
        return parseInt(unsafeFloatString)
    } catch (error) {
        return NaN
    }
};
// Transform CSV/Excel data to use location with nested latitude and longitude
export const transformCsvToLocation = (data: any[]) => {
    return data.map(row => {
        const { latitude, longitude, budgetShare, dac5PurposeCode, sector, location_type, ...rest } = row;

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
            },
            properties: {
                budgetShare: safeParseFloat(budgetShare),
                dac5PurposeCode: safeParseInt(dac5PurposeCode),
                sector_location:
                {
                    sector: sector,
                    location_type: location_type
                },
                ...rest
            }
        };
    });
};

// Transform CSV/Excel data to use location with nested latitude and longitude
export const transformExcelToLocation = (data: any[]) => {
    return data.map(row => {
        const { primaryKey, kfwProjectNoINPRO, uniqueId, latitude, longitude, sector, location_type, plannedOrActualEndDate, plannedOrActualStartDate, dateOfDataCollection, ...rest } = row;

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
            },
            properties: {
                primaryKey: primaryKey !== undefined && primaryKey !== null ? primaryKey.toString() : undefined,
                kfwProjectNoINPRO: kfwProjectNoINPRO !== undefined && kfwProjectNoINPRO !== null ? kfwProjectNoINPRO?.toString() : undefined,
                uniqueId: uniqueId !== undefined && uniqueId !== null ? uniqueId.toString() : undefined,
                plannedOrActualEndDate: excelDateToString(plannedOrActualEndDate),
                plannedOrActualStartDate: excelDateToString(plannedOrActualStartDate),
                dateOfDataCollection: excelDateToString(dateOfDataCollection),
                sector_location:
                {
                    sector: sector,
                    location_type: location_type
                },
                ...rest
            }
        };
    });
};