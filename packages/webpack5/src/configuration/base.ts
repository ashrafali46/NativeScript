import Config from 'webpack-chain';
import { IWebpackEnv } from '../index';
import {
	getAbsoluteDistPath,
	getEntryPath,
	getPlatform,
} from '../helpers/project';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { DefinePlugin } from 'webpack';
import { WatchStateLoggerPlugin } from '../plugins/WatchStateLoggerPlugin';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

export default function (config: Config, env: IWebpackEnv): Config {
	const entryPath = getEntryPath();
	const platform = getPlatform();
	const mode = env.production ? 'production' : 'development';

	// set mode
	config.mode(mode);

	// package.json is generated by the CLI with runtime options
	// this ensures it's not included in the bundle
	config.externals(['package.json']);

	// todo: devtool
	config.devtool('inline-source-map');

	// todo: figure out easiest way to make "node" target work in ns
	// rather than the custom ns target implementation that's hard to maintain
	// appears to be working - but we still have to deal with HMR
	config.target('node');

	config.entry('bundle').add(entryPath);

	config.output
		.path(getAbsoluteDistPath())
		.pathinfo(false)
		.publicPath('')
		.libraryTarget('commonjs')
		.globalObject('global');

	// Set up Terser options
	config.optimization.minimizer('TerserPlugin').use(TerserPlugin, [
		{
			terserOptions: {
				compress: {
					collapse_vars: platform !== 'android',
					sequences: platform !== 'android',
				},
				// todo: move into vue.ts if not required in other flavors?
				keep_fnames: true,
			},
		},
	]);

	config.optimization.splitChunks({
		cacheGroups: {
			defaultVendor: {
				test: /[\\/]node_modules[\\/]/,
				priority: -10,
				name: 'vendor',
				chunks: 'all',
			},
		},
	});

	// look for loaders in
	//  - node_modules/@nativescript/webpack/dist/loaders
	//  - node_modules
	// allows for cleaner rules, without having to specify full paths to loaders
	config.resolveLoader.modules
		.add('node_modules/@nativescript/webpack/dist/loaders')
		.add('node_modules');

	// inspector_modules
	config.when(shouldIncludeInspectorModules(env), (config) => {
		config
			.entry('tns_modules/@nativescript/core/inspector_modules')
			.add('@nativescript/core/inspector_modules');
	});

	config.resolve.extensions
		.add(`.${platform}.ts`)
		.add('.ts')
		.add(`.${platform}.js`)
		.add('.js')
		.add(`.${platform}.css`)
		.add('.css')
		.add(`.${platform}.scss`)
		.add('.scss')
		.add(`.${platform}.json`)
		.add('.json');

	// base aliases
	config.resolve.alias
		.set('~/package.json', 'package.json')
		.set('~', '<TODO>appFullPath')
		.set('@', '<TODO>appFullPath');

	// resolve symlinks
	config.resolve.symlinks(true);

	// set up ts support
	config.module
		.rule('ts')
		.test([/\.ts$/])
		.use('ts-loader')
		.loader('ts-loader')
		.options({
			// configFile: '',
			transpileOnly: true,
			allowTsInNodeModules: true,
			compilerOptions: {
				sourceMap: true,
				declaration: false,
			},
			getCustomTransformers() {
				return {
					before: [require('../transformers/NativeClass')],
				};
			},
		});

	// set up js
	// todo: do we need babel-loader? It's useful to support it
	config.module
		.rule('js')
		.test(/\.js$/)
		.use('babel-loader')
		.loader('babel-loader');

	// set up css
	config.module
		.rule('css')
		.test(/\.css$/)
		.use('apply-css-loader')
		.loader('apply-css-loader')
		.end()
		.use('css2json-loader')
		.loader('css2json-loader');

	// set up scss
	config.module
		.rule('scss')
		.test(/\.scss$/)
		.use('apply-css-loader')
		.loader('apply-css-loader')
		.end()
		.use('css2json-loader')
		.loader('css2json-loader')
		.end()
		.use('scss-loader')
		.loader('scss-loader');

	// items to clean
	config.plugin('CleanWebpackPlugin').use(CleanWebpackPlugin, [
		{
			cleanOnceBeforeBuildPatterns: [`${getAbsoluteDistPath()}/**/*`],
			verbose: !!env.verbose,
		},
	]);

	// todo: refine defaults
	config.plugin('DefinePlugin').use(DefinePlugin, [
		{
			__DEV__: mode === 'development',
			__NS_WEBPACK__: true,
			__CSS_PARSER__: JSON.stringify('css-tree'), // todo: replace from config value
			__ANDROID__: platform === 'android',
			__IOS__: platform === 'ios',
			/* for compat only */ 'global.isAndroid': platform === 'android',
			/* for compat only */ 'global.isIOS': platform === 'ios',
			process: 'global.process',
			/* todo: remove if fixed in core? */ profile: '() => {}',
		},
	]);

	// todo: we should probably move away from CopyWebpackPlugin
	// it has many issues we can solve by simply copying files **before** the build even starts
	// this is just a temp inline plugin that does nothing while building out the configs.
	// config.plugin('CopyWebpackPlugin').use(function CopyPluginTemp() {}, [
	// 	{
	// 		patterns: [],
	// 	},
	// ]);

	// todo: make opt-in with a flag
	config.plugin('BundleAnalyzerPlugin').use(BundleAnalyzerPlugin);

	// add the WatchStateLogger plugin used to notify the CLI of build state
	config.plugin('WatchStateLoggerPlugin').use(WatchStateLoggerPlugin);

	return config;
}

function shouldIncludeInspectorModules(env: IWebpackEnv): boolean {
	const platform = getPlatform();
	// todo: check if core modules are external
	// todo: check if we are testing
	return platform === 'ios';
}
