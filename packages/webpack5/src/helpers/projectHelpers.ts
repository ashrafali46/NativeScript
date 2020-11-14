import { existsSync } from 'fs';
import { resolve } from 'path';
import { IWebpackEnv } from '@nativescript/webpack';

export function getDistPath(env: IWebpackEnv) {
	if (env.ios) {
		return `platforms/ios/[todo]/app`;
	}

	if (env.android) {
		return `platforms/android/app/src/main/assets/app`;
	}

	// todo: additional platforms
	// perhaps we could combine platform specifics into "plugins"
	// 3rd party platforms would be treated the same
}

export function getPackageJson(projectDir: string) {
	const packageJsonPath = getPackageJsonPath(projectDir);
	const result = readJsonFile(packageJsonPath);

	return result;
}

export function readJsonFile(filePath: string) {
	return require(filePath) as {
		main: string;
		// to be extended?
	};
}

export function getPackageJsonPath(projectDir: string) {
	const packagePath = resolve(projectDir, 'package.json');
	if (existsSync(packagePath)) {
		return packagePath;
	} else {
		return getPackageJsonPath(resolve(projectDir, '..'));
	}
}
