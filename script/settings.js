//@huntbao @mknote
//All right reserved
(function(undefined){
    'use strict';
    var maikuNoteOptions = {};
	var getOption = function(key, defaultValue){
		var options = JSON.parse(window.localStorage[maikuNoteOptions.localstoragekey] || '{}');
        if(options[key] === undefined){
            return defaultValue;
        }else{
            return options[key];
        }
	}
	var setOption = function(key, value){
		var options = JSON.parse(window.localStorage[maikuNoteOptions.localstoragekey] || '{}');
		options[key] = value;
		window.localStorage[maikuNoteOptions.localstoragekey] = JSON.stringify(options);
	}
    Object.defineProperty(maikuNoteOptions, 'localstoragekey', {
        value: '__MaikuWebClipperOptions__',
        writable: false
    });
    Object.defineProperties(maikuNoteOptions, {
        serializeImg: {
            get: function(){
                return getOption('serializeImg', true);
            },
            set: function(value){
                setOption('serializeImg', value);
            }
        },
        defaultCategory: {
            get: function(){
                return getOption('defaultCategory', '');
            },
            set: function(value){
                setOption('defaultCategory', value);
            }
        },
        autoExtractContent: {
            get: function(){
                return getOption('autoExtractContent', true);
            },
            set: function(value){
                setOption('autoExtractContent', value);
            }
        },
        imageAttachment: {
            get: function(){
                return getOption('imageAttachment', false);
            },
            set: function(value){
                setOption('imageAttachment', value);
            }
        }
    });
	window.maikuNoteOptions = maikuNoteOptions;
})();