import './scss/FileValidator.scss'

import React, { useEffect, useState } from "react";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import Papa from "papaparse";
import * as xlsx from "xlsx";
import MapComponent from "./MapComponent";

import { transformCsvToLocation, transformExcelToLocation } from "../services/util/FileConversionMethods";
import { saveAs } from 'file-saver';


export default function FileValidator(): React.ReactElement {

	const [validationResult, setValidationResult] = useState<string | null>(null);
	//const [ geojson, setGeojson ] = useState<any>(null);	
	const [geoJsonDataWrap, setGeoJsonDataWrap] = useState<any>(null);
	const [fileInputKey, setFileInputKey] = useState<number>(0);

	let validateProject
	const branch = "2025-02-10-devdocs"
	const schema_json_urls = [
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/sector_location_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/dac5_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/feature_project_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/project_core_schema.json`
	];

	useEffect(() => {
		// Executes once at the beginning of rendering -> therefore empty array as param

		async function load_schemas() {

			const ajv = new Ajv({ allErrors: true });
			addFormats(ajv);

			for (const url of schema_json_urls) {
				try {
					const res = await fetch(url)
					if (!res.ok) console.error(`HTTP error-status: ${res.status}`)
					const json = await res.json()
					ajv.addSchema(json)
				} catch (err) {
					console.error(`Error loading schema ${url}:\n`, err)
				}
			}

			// eslint-disable-next-line
			validateProject = ajv.getSchema("feature_project_schema.json")
		}

		load_schemas()

		// eslint-disable-next-line
	})

	const resetMap = () => {

		// Clear the GeoJSON data and reset the validation result
		setGeoJsonDataWrap(null);
		setValidationResult(null);
		setFileInputKey((prev) => prev + 1);

	};

	// FileUpload Event und Filetyp-Verarbeitung
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {

		const file = event.target.files?.[0];
		if (!file) return;

		const fileType = file.type;

		//Fall 1. direktes Einspielen als GeoJson TODO: Bisher wird nur eine Feature als Geojson-Upload verarbeitet mehrere Features noch nicht
		if (fileType === "application/json") {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					// Parse the uploaded GeoJSON
					const geoJsonData = JSON.parse(e.target?.result as string);

					// Check if the input is a Feature or a FeatureCollection
					if (geoJsonData.type === "Feature") {
						// Validate a single Feature
						const isValid = validateProject ? validateProject(geoJsonData) : false;

						if (isValid) {
							setValidationResult("GeoJSON Feature is valid!");
							setGeoJsonDataWrap({ type: "FeatureCollection", features: [geoJsonData] }); // Wrap in FeatureCollection
						} else {
							// Format validation errors
							const errors = validateProject.errors || [];
							console.log(errors);
							
							// Check if there are any coordinate-related errors
							const hasCoordinateErrors = errors.some(error => 
								(error.instancePath && (
									error.instancePath.startsWith("/geometry/coordinates") || 
									error.instancePath === "/geometry/type" ||
									(error.instancePath === "/geometry" && 
									(error.message?.includes("required property") || 
									error.message?.includes("must match exactly one schema") ||
									error.message?.includes("must be null")))
								))
							);
							
							const formattedErrors = [];
							
							// If coordinate errors exist, add a single clear message
							if (hasCoordinateErrors) {
								formattedErrors.push(`Error: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map.`);
							}
							
							// Add all non-coordinate related errors
							errors.forEach(error => {
								// Skip coordinate-related errors
								if (error.instancePath && (
									error.instancePath.startsWith("/geometry/coordinates") || 
									error.instancePath === "/geometry/type" ||
									(error.instancePath === "/geometry" && 
									(error.message?.includes("required property") || 
									error.message?.includes("must match exactly one schema") ||
									error.message?.includes("must be null")))
								)) {
									return; // Skip this error
								}
								
								// Format and add other errors
								const path = error.instancePath ? ` at "${error.instancePath}"` : "";
								const message = error.message ? `: ${error.message}` : "";
								formattedErrors.push(`Error${path}${message}`);
							});
							setValidationResult(`GeoJSON Feature Validation Errors:\n${formattedErrors.join("\n")}`);
						}
					} else if (geoJsonData.type === "FeatureCollection") {
						// Validate each feature in the FeatureCollection
						const transformedFeatures = geoJsonData.features.map((feature) => {
							const isValid = validateProject ? validateProject(feature) : false;

							if (isValid) {
								return feature; // Include only valid features
							} else {
								console.log("Invalid feature:", feature);
								// Optionally log or handle invalid features here
								return null;
							}
						}).filter((feature) => feature !== null); // Remove invalid features

						if (transformedFeatures.length === geoJsonData.features.length) {
							setValidationResult("GeoJSON FeatureCollection is valid!");
						} else {
							setValidationResult(
								"Some features in the GeoJSON FeatureCollection failed validation."
							);
						}

						// Set the valid features in the state
						setGeoJsonDataWrap({
							type: "FeatureCollection",
							features: transformedFeatures,
						});
					} else {
						setValidationResult("Error: GeoJSON file must be a Feature or FeatureCollection.");
					}
				} catch (error) {
					console.error(error);
					setValidationResult("Error parsing GeoJSON file.");
				}
			};
			reader.readAsText(file);
		}
		//Upload CSV oder Excel
		else if (fileType === "text/csv" || fileType === "application/vnd.ms-excel" || fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
			// Parse CSV or Excel
			const reader = new FileReader();
			reader.onload = (e) => {
				const data = e.target?.result;

				if (fileType === "text/csv") {
					// Parse CSV
					const parsedData = Papa.parse(data as string, { header: true }).data;
					const transformedData = transformCsvToLocation(parsedData);
					//setGeojson(transformedData);
					setGeoJsonDataWrap({ type: "FeatureCollection", features: transformedData })
					validateParsedData(transformedData);
				} else {
					// Parse Excel TODO: Datumseinträge etc. müssen noch transformiert werden 
					const workbook = xlsx.read(data, { type: "binary" });
					const sheetName = workbook.SheetNames[1];
					const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 2 });
					const transformedData = transformExcelToLocation(excelData);
					//setGeojson(transformedData);
					setGeoJsonDataWrap({ type: "FeatureCollection", features: transformedData })
					validateParsedData(transformedData);
					console.log(transformedData)
				}
			};
			reader.readAsBinaryString(file);
		} else {
			setValidationResult("Unsupported file type. Please upload a JSON, CSV, or Excel file.");
		}

	};

	const validateParsedData = (data: any[]) => {

		// Validate each row in the CSV/Excel data, flatMap sonst ist allErrors Object nicht 0 von der Länge bei keinen fehlern 
		const allErrors = data.flatMap((row, index) => {
			if (validateProject !== undefined) {
				validateProject(row);
				return formatAjvErrorsCSVExcel(validateProject.errors, index + 1);
			}
			else {
				console.debug("validateProject is undefined")
				return []; // Return an empty array if validateProject is empty
			}

			// Format the errors for this row

		});
		console.log(allErrors)
		if (allErrors.length == 0) {
			setValidationResult("Excel/CSV data is valid!");

		} else {
			setValidationResult(`Validation Errors:\n${allErrors.join("\n")}`);
		}

	};

	// formatieren der Fehler für Excel und CSV, ähnlich zu Geojson hier wird noch Zeilennummer mit angegeben
	const formatAjvErrorsCSVExcel = (errors: any, rowNumber: number) => {

		//console.log(errors)
		if (!errors) {
			return [];
		}

		// Check if there are any coordinate-related errors
		const hasCoordinateErrors = errors.some(error => 
			(error.instancePath && (
				error.instancePath.startsWith("/geometry/coordinates") || 
				error.instancePath === "/geometry/type" ||
				(error.instancePath === "/geometry" && 
				 (error.message?.includes("required property") || 
				  error.message?.includes("must match exactly one schema") ||
				  error.message?.includes("must be null")))
			))
		);

		// Initialize the result array
		const resultErrors = [];

		// If coordinate errors exist, add a single clear message
		if (hasCoordinateErrors) {
			resultErrors.push(`Row ${rowNumber}: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map.`);
		}

		// Add all non-coordinate related errors
		errors.forEach(error => {
			// Skip coordinate-related errors since we've already added a consolidated message for them
			if (error.instancePath && (
				error.instancePath.startsWith("/geometry/coordinates") || 
				error.instancePath === "/geometry/type" ||
				(error.instancePath === "/geometry" && 
				 (error.message?.includes("required property") || 
				  error.message?.includes("must match exactly one schema") ||
				  error.message?.includes("must be null")))
			)) {
				return; // Skip this error
			}
			
			// Format and add other errors
			const path = error.instancePath ? ` at "${error.instancePath}"` : "";
			const message = error.message ? `: ${error.message}` : "";
			resultErrors.push(`Row ${rowNumber}${path}${message}`);
		});

		return resultErrors;
	};

	const downloadProcessed = () => {

		const blob = new Blob([JSON.stringify(geoJsonDataWrap)], { type: 'application/geo+json' });
		saveAs(blob, 'validated_data.geojson');

	};

	return <>
		<div className='file_validator'>
			{/* ____________________ Header / Description ____________________ */}

			<header>
				<h1>OGM Validator</h1>
				<p>
					Open Geodata Model Validator is an open-source tool designed to validate input data against the specifications of KfWs <a href="https://openkfw.github.io/open-geodata-model/" target="_blank" style={{ color: "#007bff", textDecoration: "none" }}>Open Project Location Model</a>.
					The validator accepts both Excel and GeoJSON files as input data. It identifies errors that need to be addressed before further processing, such as missing values in mandatory fields or incorrect formats for specific entries (e.g., dates not provided in the correct format).
					Errors should be corrected in the original file using Excel or GIS software, after which the files can be re-evaluated using this tool. Additionally, you can utilize the map feature within the tool to assess the geographic accuracy of the submitted project locations.
					If you have any questions, please feel free to reach out by creating an issue in our  <a href="https://github.com/openkfw/open-geodata-model" target="_blank" style={{ color: "#007bff", textDecoration: "none" }}>GitHub repository</a>.
				</p>
				<input
					key={fileInputKey}
					type="file"
					accept=".json,.csv,.xlsx"
					onChange={handleFileUpload}
				/>
			</header>

			{/* ____________________ Validation Result ____________________ */}

			{validationResult && (
				<div className='file_validator_validation_result'>
					<h3>Validation Result</h3>
					<pre>{validationResult}</pre>
				</div>
			)}

			{/* ____________________ Map ____________________ */}

			<div className='file_validator_map'>
				<MapComponent geoJsonData={geoJsonDataWrap} />
			</div>

			{/* ____________________ Buttons ____________________ */}

			<div className='file_validator_buttons'>

				<button
					onClick={resetMap}
				>Reset Map</button>

				<button
					onClick={downloadProcessed}
				>Download GeoJSON</button>

			</div>

			{/* ____________________ Example ____________________ */}

			<h4>File Format</h4>
			<p><a href={"Project_Location_Data_Template_V02.xlsx"}>Example file</a></p>

		</div>
	</>
}