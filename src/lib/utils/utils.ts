import axios from 'axios';
import fs from 'fs';
import schemas from '$src/collections';
import type { Schema } from '$src/collections/types';
import { locales } from '$i18n/i18n-util';

import { PUBLIC_LANGUAGE } from '$env/static/public';
import type { Locales } from '$i18n/i18n-types';
import { systemLanguage } from '$src/stores/store';

export const DB = {};

// takes an array of fields and creates a schema by combining
// each field's individual schema and deleting the "widget" property.
export const fieldsToSchema = (fields: Array<any>) => {
	let schema: any = {};
	for (const field of fields) {
		schema = { ...schema, ...field.schema };
	}
	delete schema.widget;
	return schema;
};

// takes in a "req" object and processes any files associated with the request,
// it saves them to a specified file path using the "fs" library.
export function saveFiles(req: any, collection_name: string) {
	const files: any = {};
	const schema = schemas.find((schema) => schema.name === collection_name);
	const _files = req.files || [];
	//console.log(_files);
	for (const file of _files) {
		const { buffer, fieldname, ...meta } = file;
		files[fieldname as keyof typeof files] = meta;
		const path = _findFieldByTitle(schema, fieldname).path;

		if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });

		fs.writeFileSync(path + '/' + meta.originalname, buffer);
	}
	return files;
}

// finds field title that matches the fieldname and returns that field
function _findFieldByTitle(schema: any, fieldname: string, found = { val: false }): any {
	for (const field of schema.fields) {
		if (field.db_fieldName == fieldname) {
			//console.log(field);
			found.val = true;

			return field;
		} else if (field.fields.length > 0) {
			return _findFieldByTitle(field, fieldname, found);
		}
	}
	if (!found) {
		throw new Error('FIELD NOT FOUND');
	}
}

// takes an object and recursively parses any values that can be converted to JSON
export function parse(obj: any) {
	for (const key in obj) {
		try {
			if (Array.isArray(obj[key])) {
				for (const index of obj[key]) {
					obj[key][index] = JSON.parse(obj[key][index]);
				}
			} else {
				obj[key] = JSON.parse(obj[key]);
			}
		} catch (e) {}

		if (typeof obj[key] != 'string') {
			parse(obj[key]);
		}
	}
	return obj;
}

// find a specific document in a specified collection by ID
export async function findById(id: string, collection: Schema) {
	if (!id || !collection) return;
	return (await axios.get(`/api/findById?collection=${collection.name}&id=${id}`)).data;
}

// find a specific document in a specified collection
export async function find(query: object, collection: Schema) {
	const _query = JSON.stringify(query);
	return (await axios.get(`/api/find?collection=${collection.name}&query=${_query}`)).data;
}

// exports an object with a "Content-Type" of "multipart/form-data"
export const config = {
	headers: {
		'Content-Type': 'multipart/form-data'
	}
};

// takes an array of objects and creates an HTML string.
export function format(
	value: Array<{
		label?: string;
		text: string;
		labelColor?: string;
		textColor?: string;
		newLine?: boolean;
	}>
) {
	let html = '';
	for (const item of value) {
		const htmlTag = item.newLine ? 'p' : 'span';
		html += ` <${htmlTag} style=color:${
			item.textColor
		} class=dark:text-white text-black> <span class=dark:text-white text-black style=color:${
			item.labelColor
		}> ${item.label ? item.label + ':' : ''} </span> ${item.text}</${htmlTag}>`;
	}
	return html;
}

// iterates over each key, it checks the type of the value of the current key in the specified language
export function flattenData(data: any, language: string) {
	if (!data) return [];
	return Object.keys(data).reduce((acc: any, x) => {
		acc[x] =
			data[x] && data[x].constructor == Object && (data[x][language] || data[x][PUBLIC_LANGUAGE])
				? data[x][language] || data[x][PUBLIC_LANGUAGE]
				: data[x];

		return acc;
	}, {});
}

// Replaces the locale slug in a URL.
export const replaceLocaleInUrl = (
	url: URL,
	locale: string,
	user: string = '',
	full = false
): string => {
	const [, , ...rest] = url.pathname.split('/');
	//console.log('utils', url);
	const haveLocale = locales.includes(url?.pathname?.split('/')[1] as Locales);
	let systemValue;

	systemLanguage.subscribe((value) => {
		systemValue = value;
	});

	if (url.pathname.includes(locale) && locale !== systemValue) {
		return url.pathname;
	}

	let tempPath;
	const tempLocale = locale === systemValue ? '/' : `/${locale}/`;

	if (haveLocale) {
		tempPath = url.pathname.split('/').slice(2).join('/');
	} else {
		tempPath = url.pathname.split('/').slice(1).join('/');
	}

	const new_pathname = `${tempLocale.toString()}`;

	if (!full) {
		return `${new_pathname}${tempPath}${url.search}`;
	}
	const newUrl = new URL(url.toString());
	newUrl.pathname = `${new_pathname}`;

	return newUrl.toString();
};

// This function converts a file object to a data URL string that can be used to display or upload the contents of the file.
export const fileToDataUrl = (file: File) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (event) => {
			// Resolve the promise with the base64-encoded contents of the file.
			resolve((event.target as any).result);
		};
		reader.onerror = reject;
		// Read the contents of the file as a data URL string.
		reader.readAsDataURL(file);
	});
};
