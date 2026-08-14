/*
    NativeShare JS 模块 — 暴露为 window.NativeShare
      shareText(title, text, success, error)
      shareFile(title, fileName, content, success, error)
      saveFile(title, fileName, content, success, error)
    浏览器（无 Cordova）中该对象不存在，调用方需自行降级。
 */
var exec = require('cordova/exec');

module.exports = {
    shareText: function (title, text, success, error) {
        exec(success, error, 'NativeShare', 'shareText', [title, text]);
    },
    shareFile: function (title, fileName, content, success, error) {
        exec(success, error, 'NativeShare', 'shareFile', [title, fileName, content]);
    },
    saveFile: function (title, fileName, content, success, error) {
        exec(success, error, 'NativeShare', 'saveFile', [title, fileName, content]);
    }
};
