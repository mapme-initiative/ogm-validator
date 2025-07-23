import './scss/FileValidator.scss'

import React, {useState} from "react";
import Ajv, {ErrorObject} from "ajv";
import addFormats from "ajv-formats";
import Papa from "papaparse";
import * as xlsx from "xlsx";
import {WorkBook} from "xlsx";
import MapComponent from "./MapComponent";

import {transformCsvToLocation, transformExcelToLocation} from "../services/util/FileConversionMethods";
import {saveAs} from 'file-saver';
import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import SendMailButton from "./SendMailButton.tsx";

function getDataBySheetName(workbook: WorkBook, sheetName: string) {
	const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {range: 2});
	return transformExcelToLocation(excelData);
}

function handleJsonFiles(areFormatsLoaded: boolean, ajv: Ajv, setValidationResult: (value: (((prevState: (string | null)) => (string | null)) | string | null)) => void, setGeoJsonDataWrap: (value: any) => void, file) {
	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			//init validateProjects
			if (!areFormatsLoaded)
				return <p style={{color: 'white'}}>Schemas couldn't loaded. Check your internet connection and please
					refresh this page</p>
			const validateProject = ajv.getSchema("feature_project_schema.json")

			// Parse the uploaded GeoJSON
			const geoJsonData = JSON.parse(e.target?.result as string);

			// Check if the input is a Feature or a FeatureCollection
			if (geoJsonData.type === "Feature") {
				// Validate a single Feature
				const isValid = validateProject ? validateProject(geoJsonData) : false;

				if (isValid) {
					setValidationResult("GeoJSON Feature is valid!");
					setGeoJsonDataWrap({type: "FeatureCollection", features: [geoJsonData]}); // Wrap in FeatureCollection
				} else {
					// Format validation errors
					const formattedErrors = (validateProject.errors || []).map((error) => {
						console.log(error);
						const path = error.instancePath ? ` at "${error.instancePath}"` : "";
						const message = error.message ? `: ${error.message}` : "";
						return `Error${path}${message}`;
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

function handleCSVFiles(data: string | ArrayBuffer | null | undefined, setGeoJsonDataWrap: (value: any) => void, validateParsedData: (data: any[]) => (React.JSX.Element | undefined)) {
	const parsedData = Papa.parse(data as string, {header: true}).data;
	const transformedData = transformCsvToLocation(parsedData);
	//setGeojson(transformedData);
	setGeoJsonDataWrap({type: "FeatureCollection", features: transformedData})
	validateParsedData(transformedData);
}

function handleExcelFiles(data: string | ArrayBuffer | null | undefined, setOpenNoSheetDialog, continueWithExcelErrors: boolean, lastValidationStep: (workbook: WorkBook, setGeoJsonDataWrap: (value: any) => void, validateParsedData: (data: any[]) => (React.JSX.Element | undefined)) => void, setGeoJsonDataWrap: (value: any) => void, validateParsedData: (data: any[]) => (React.JSX.Element | undefined)) {
	// Parse Excel TODO: Datumseinträge etc. müssen noch transformiert werden
	const wb = xlsx.read(data, {type: "binary"})
	const sheetName = wb.SheetNames[1];
	if (sheetName !== "fill-me") {
		setOpenNoSheetDialog(true)
		if (!continueWithExcelErrors) {
			return
		}
	}
	lastValidationStep(wb, setGeoJsonDataWrap, validateParsedData);
}

export default function FileValidator(): React.ReactElement {

	const [ validationResult, setValidationResult ] = useState<string | null>(null);
	//const [ geojson, setGeojson ] = useState<any>(null);
	const [ geoJsonDataWrap, setGeoJsonDataWrap ] = useState<any>(null);
	const [ fileInputKey, setFileInputKey ] = useState<number>(0);
	const [ isPending, setIsPending] = useState(true)
	const [ areFormatsLoaded, setAreFormatsLoaded] = useState(false)
	const [ connErros, setConnErros] = useState("Loading...")
	const [ continueWithExcelErrors, setContinueWithExcelErrors] = useState(false)
	const [ enableEMailButton, setEnableEMailButton] = useState<boolean>(false);
	const [openNoSheetDialog, setOpenNoSheetDialog] = React.useState(false);
	const [inProNumbers, setInProNumbers] = useState<Set<string> | null>(null);

	const branch = "2025-02-10-devdocs"
	const schema_json_urls = [
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/sector_location_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/dac5_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/feature_project_schema.json`,
		`https://raw.githubusercontent.com/openkfw/open-geodata-model/${branch}/references/project_core_schema.json`
	];
	const resetMap = () => {

		// Clear the GeoJSON data and reset the validation result
		setGeoJsonDataWrap(null);
		setValidationResult(null);
		setFileInputKey(0);
		setContinueWithExcelErrors(false)
		setOpenNoSheetDialog(false)
		setEnableEMailButton(false)

	};


	const fetchPromises = schema_json_urls.map(url => fetch(url).then(r => r.json()))
	const ajv = new Ajv({ allErrors:true });


	function lastValidationStep(workbook: WorkBook, setGeoJsonDataWrap: (value: any) => void, validateParsedData: (data: any[]) => React.JSX.Element) {
		if(workbook == null)
			return
		const sheetName = workbook.SheetNames[1];
		const transformedData = getDataBySheetName(workbook, sheetName === "fill-me" ? "fill-me" : workbook.SheetNames[0]);
		//setGeojson(transformedData);
		setGeoJsonDataWrap({type: "FeatureCollection", features: transformedData})
		validateParsedData(transformedData);
		console.log(transformedData)
	}

	Promise.all(fetchPromises)
		.then(results => {
			results.map(r => ajv.addSchema(r))
			return ajv
		})
		.then(ajv => {
			addFormats(ajv)
			setIsPending(false)
			setAreFormatsLoaded(true)
		})
		.catch(e => {
			setConnErros(e.message)
		})

	// FileUpload Event und Filetyp-Verarbeitung
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		resetMap()
		const file = event.target.files?.[0];
		if (!file) return;

		const fileType = file.type;

		//Fall 1. direktes Einspielen als GeoJson TODO: Bisher wird nur eine Feature als Geojson-Upload verarbeitet mehrere Features noch nicht
		if (fileType === "application/json") {
			handleJsonFiles(areFormatsLoaded, ajv, setValidationResult, setGeoJsonDataWrap, file);
		}
		//Upload CSV oder Excel
		else if (fileType === "text/csv" || fileType === "application/vnd.ms-excel" || fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
			// Parse CSV or Excel
			const reader = new FileReader();
			reader.onload = (e) => {
				const data = e.target?.result;
				if (fileType === "text/csv") {
					// Parse CSV
					handleCSVFiles(data, setGeoJsonDataWrap, validateParsedData);
				} else {
					handleExcelFiles(data, setOpenNoSheetDialog, continueWithExcelErrors, lastValidationStep, setGeoJsonDataWrap, validateParsedData);
				}
			};
			reader.readAsBinaryString(file);
		} else {
			setValidationResult("Unsupported file type. Please upload a JSON, CSV, or Excel file.");
		}

	};

	const validateParsedData = (data: any[]) => {

		//init validateProjects
		if(!areFormatsLoaded)
			return <p style={{color: 'white'}}>Schemas couldn't loaded. Check your internet connection and please refresh this page</p>
		const validateProject = ajv.getSchema("feature_project_schema.json")

		// Validate each row in the CSV/Excel data, flatMap sonst ist allErrors Object nicht 0 von der Länge bei keinen fehlern
		try {
			if (!validateProject) {
				setValidationResult("something went wrong")
				return
			}
			const allErrors = data
				.flatMap((row, index) => {
					validateProject(row);
					if(validateProject.errors != null)
						return formatAjvErrorsCSVExcel(validateProject.errors, index + 1);
					else
						return
					// Format the errors for this row
				})
				.filter(e => e !== undefined)
			console.log("validateParsedData().allErrors", allErrors)
			if (allErrors.length == 0) { // Wenn keine Fehler gefunden wurden & alle datenreihen eine inproNumber haben, dann aktiviere den Mail-Button
				setValidationResult("Excel/CSV data is valid!");
				console.log("validateParsedData().data:", data)
				const localInproNumbers = data.map((f) => f.properties.kfwProjectNoINPRO.replaceAll(" ", ""))
				console.log("validateParsedData().localInproNumbers:", localInproNumbers)
				if(localInproNumbers.filter((n: any) => n === undefined && n === null).length > 0) { // this here should never happened, it just represent the worst case of data cause we've finished our validation-process!
					setValidationResult("Something terrible happend, we've inpro-nos which are null or undefined and they passed our validation. Please check your data again and send this crazy dataset to the it-support (us), please.")
					return ;
				}
				setEnableEMailButton(true)
				setInProNumbers(new Set(localInproNumbers))
			} else {
				setValidationResult(`Validation Errors:\n${allErrors.join("\n")}`);
				setEnableEMailButton(false)
			}
		} catch (e) {
			setValidationResult(e.message)
		}

	};

	// formatieren der Fehler für Excel und CSV, ähnlich zu Geojson hier wird noch Zeilennummer mit angegeben
	const formatAjvErrorsCSVExcel = (errors: ErrorObject[], rowNumber: number) => {

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

	if(isPending)
		return <p style={{color: 'white'}}>{connErros}</p>
	return <>
		<div className='file_validator'>

			<Dialog
				open={openNoSheetDialog}
				onClose={resetMap}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">
					{"'fill-me' Sheet not found!"}
				</DialogTitle>
				<DialogContent>
					<DialogContentText id="alert-dialog-description">
						{"You dont use the original excel-template. The excel-template has a second sheet called fill-me please adjust your data."}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={resetMap} autoFocus>
						I will reset map and retry manually
					</Button>
				</DialogActions>
			</Dialog>

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
				<SendMailButton isEnabled={enableEMailButton} {...(inProNumbers ? {inProNumbers: [...inProNumbers] } : {})}/>
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

			<h4>Example Files:</h4>
			<ul>
				<li><p><a href={"/ogm-validator/Project_Location_Data_Template_V02.xlsx"}>working example</a></p></li>
				<li><p><a href={"/ogm-validator/sheet_not_found.xlsx"}>no fill-me sheet</a></p></li>
				<li><p><a href={"/ogm-validator/invalid_data.xlsx"}>invalid_data</a></p></li>
				<li><p><a href={"/ogm-validator/missing_lat_lon.xlsx"}>missing_lat_lon</a></p></li>
			</ul>

		</div>

	</>
}
