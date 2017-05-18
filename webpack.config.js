var path = require('path');
var webpack = require('webpack');
var LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

module.exports = {
  entry: ['whatwg-fetch','./src/index.js','./scss/main.scss'],
  //devtool: "cheap-eval-source-map",
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname,'build'),
    publicPath: '/build'
  },
  module: {
    loaders: [
      {
        test: /\.(js)$/,
        exclude: /(node_modules|build)/,
        loader: 'babel-loader',
        query: {
          plugins: ['lodash'],
          presets: ['es2015']
        }
      },
      {
        test: /\.scss$/,
        loaders: ['style-loader','css-loader','sass-loader']
      }
    ]
  },
  plugins: [
    new LodashModuleReplacementPlugin,
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: false,
      beautify: true
    })
  ]
};
