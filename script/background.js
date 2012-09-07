//@huntbao @mknote
//All right reserved
//Notice: chrome version below 20 will not work for this extension
//(since it has no chrome.extension.sendMessage method and Blob() constructor is illegal and etc.)
(function($){
    'use strict';
    window.maikuNote = {
        init: function(){
            var self = this;
            self.jQuerySetUp();
            self.browserAction();
            self.initManagement();
            self.initExtensionConnect();
			self.initTabEvents();
			self.initExtensionRequest();
			//self.removeFileSystems();
            //self.initOmnibox();
        },
        browserAction:function(){
            var self = this;
            chrome.browserAction.onClicked.addListener(function(tab){
				if(!chrome.extension.sendMessage){
					self.notifyHTML(chrome.i18n.getMessage("BrowserTooLower"), 30000);
					return;
				}
				self.createPopup();
            });
        },
		createPopup: function(){
			chrome.tabs.executeScript(null, {code: "maikuClipper.createPopup();"});
		},
        closePopup: function(){
            chrome.tabs.executeScript(null, {code: "maikuClipper.closePopup();"});
        },
        initContextMenus:function(beforeCreate){
            var self = this;
			if(!chrome.extension.sendMessage){
				return;
			}
            if(self.isCreatingContextMenus) return;
            self.isCreatingContextMenus = true;
            chrome.contextMenus.removeAll(function(){
				self.createTopPriorityContextMenu();
				beforeCreate && beforeCreate();
				self.createNormalContextMenus();
            });
        },
		createTopPriorityContextMenu: function(){
			var self = this;
			chrome.contextMenus.create({
                contexts: ['selection'],
                title: chrome.i18n.getMessage("clipSelectionContextMenu"),
                onclick: function(info, tab){
					self.saveNote(info.selectionText, info.pageUrl, info.selectionText);
                }
            });
		},
        createNormalContextMenus:function(){
            var self = this;
            chrome.contextMenus.create({
                contexts: ['image'],
                title: chrome.i18n.getMessage('clipImageContextMenu'),
                onclick: function(info, tab){
                    self.saveImgs({
                        imgs: [info.srcUrl],
                        title: tab.title,
                        imgTitles: [tab.title],
                        sourceurl: tab.url
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['link'],
                title: chrome.i18n.getMessage('clipLinkContextMenu'),
                onclick: function(info, tab){
                    chrome.tabs.executeScript(tab.id, {code: "maikuClipper.getLinkInfoByUrl('" + info.linkUrl + "');"});
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageContextMenu'),
                onclick: function(info, tab){
                    self.notifyHTML(chrome.i18n.getMessage('IsClippingPage'), false);
                    chrome.tabs.executeScript(tab.id, {code: "maikuClipper.getPageContent();"});
                }
            });chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllImageContextMenu'),
                onclick: function(info, tab){
                    chrome.tabs.executeScript(tab.id, {code: "maikuClipper.getAllImages();"});
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllLinkContextMenu'),
                onclick: function(info, tab){
                    chrome.tabs.executeScript(tab.id, {code: "maikuClipper.getAllLinks();"});
                }
            });
			chrome.contextMenus.create({type: 'separator', contexts: ['all']});
            
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageUrlContextMenu'),
                onclick: function(info, tab){
                    var content = '<img src="' + tab.favIconUrl + '" title="' + tab.title + '" alt="' + tab.title + '"/>'
                        + '<a href="' + tab.url + '" title="' + tab.title + '">' + tab.url + '</a>';
                    self.saveNote(tab.title, tab.url, content);
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('pageCaptureContextMenu'),
                onclick: function(info, tab){
                    self.insureLogin(function(){
                        chrome.pageCapture.saveAsMHTML({
                            tabId: tab.id
                        }, function(mhtmlBlob){
                            self.notifyHTML(chrome.i18n.getMessage('IsClippingPage'), false);
                            window.requestFileSystem(TEMPORARY, mhtmlBlob.size, function(fs){
                                self.writeBlobAndSendFile(fs, mhtmlBlob, tab.title + '.mhtml', function(file){
                                    self.notifyHTML(chrome.i18n.getMessage('pageCaptureUploading'));
                                    var formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('type', 'Attachment');
                                    $.ajax({
                                        url: self.baseUrl + "/attachment/save/",
                                        type: "POST",
                                        data: formData,
                                        processData: false,
                                        contentType: false,
                                        success: function(data){
                                            if(data.error){
                                                //todo: server error, pending note...
                                                console.log('Internal error: ')
                                                console.log(data.error)
                                                return;
                                            }
                                            var d = data.Attachment;
                                            self.removeFile(d.FileName, d.FileSize);
                                            self.saveNote(tab.title, tab.url, '', '', '', d.NoteID);
                                        },
                                        error: function(jqXHR, textStatus, errorThrown){
                                            console.log('xhr error: ')
                                            console.log(textStatus)
                                        }
                                    });
                                    
                                }, function(){
                                    self.notifyHTML(chrome.i18n.getMessage('pageCaptureFailed'));
                                });
                            }, self.onFileError);
                        });
                    });
                }
            });
            
            chrome.contextMenus.create({type: 'separator', contexts: ['all']});
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("newNoteContextMenu"),
                contexts: ['all'],
                onclick: function(info, tab) {
                    self.createPopup();
                }
            });
            chrome.contextMenus.create({type: 'separator', contexts: ['all']});
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("RetrieveRemoteImg"),
                contexts: ['all'],
                type: 'checkbox',
                checked: maikuNoteOptions.serializeImg || false,
                onclick: function(info, tab){
                    self.setMaikuOption('serializeImg', info.checked);
                }
            });
            self.isCreatingContextMenus = false;
        },
        insureLogin: function(callback){
            var self = this;
            if(self.userData){
                callback && callback();
            }else{
                self.notifyHTML(chrome.i18n.getMessage('NotLogin'), false);
                self.checkLogin(function(){
                    callback && callback();
                });
            }
        },
		saveNote:function(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback){
			var self = this;
            self.insureLogin(function(){
                self._saveNote(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback);
            });
		},
        _saveNote: function(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback){
            var self = this;
			if(!title && !notecontent){
				self.notifyHTML(chrome.i18n.getMessage('CannotSaveBlankNote'));
				return;
			}
			var dataObj = {
				title: self.getTitleByText(title),
				sourceurl: sourceurl,
				notecontent: notecontent,
				tags: tags || '',
				categoryid: categoryid || '',
				noteid: noteid || '',
				importance: importance || 0
			}
			self.notifyHTML(chrome.i18n.getMessage('IsSavingNote'), false);
			$.ajax({
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
				type:'POST',
				url: self.baseUrl + '/note/save',
				data: JSON.stringify(dataObj),
				success: function(data){
					if(data.error){
                        if(data.error == 'notlogin'){
                            self.notifyHTML(chrome.i18n.getMessage('NotLogin'));
                        }else{
                            self.notifyHTML(chrome.i18n.getMessage('SaveNoteFailed'));
                        }
                        failCallback && failCallback();
						return;
					}
                    successCallback && successCallback();
                    var successTip = chrome.i18n.getMessage('SaveNoteSuccess'),
                    viewURL = self.baseUrl + '/note/previewfull/' + data.Note.NoteID,
                    viewTxt = chrome.i18n.getMessage('ViewText');
					self.notifyHTML(successTip + '<a href="' + viewURL + '" target="_blank" id="closebtn">' + viewTxt + '</a>', 10000);
				},
				error: function(jqXHR, textStatus, errorThrown){
                    failCallback && failCallback();
					self.notifyHTML(chrome.i18n.getMessage('SaveNoteFailed'));
				}
			});
        },
        saveImgs: function(msg, successCallback, failCallback){
            var self = this;
            self.insureLogin(function(){
                self._saveImgs(msg, successCallback, failCallback);
            });
        },
        _saveImgs: function(msg, successCallback, failCallback){
            var self = this,
            content = '',
            imgs = msg.imgs,
            titles = msg.imgTitles,
            saveNormalNote = function(){
                for(var i = 0, l = imgs.length; i < l; i++){
                    content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                }
                self.saveNote(msg.title, msg.sourceurl, content, msg.tags);
            }
            if(maikuNoteOptions.serializeImg){
                //retrieve remote images
                self.notifyHTML(chrome.i18n.getMessage('isRetrievingRemoteImgTip'), false);
                var totalImgNum = imgs.length,
                serializeSucceedImgNum = 0,
                serializeFailedImgNum = 0,
                serializeSucceedImgIndex = [],
                serializeSucceedImgIndexByOrder = {},
				files = {},
				removeFiles = function(){
					for(var idx in files){
						self.removeFile(files[idx].name, files[idx].size);
					}
				},
                checkComplete = function(){
                    if(serializeSucceedImgNum + serializeFailedImgNum == totalImgNum){
                        if(serializeFailedImgNum == totalImgNum){
                            //all images retrieve failed
                            if(failCallback){
                                //is replace images in page content
                                failCallback(true);
                            }else{
                                self.notifyHTML(chrome.i18n.getMessage('RetrieveImagesFailed'));
                                saveNormalNote();
                            }
                            return false;
                        }
                        for(var i = 0, l = serializeSucceedImgIndex.length; i < l; i++){
                            serializeSucceedImgIndexByOrder[serializeSucceedImgIndex[i]] = i.toString();
                        }
                        self.notifyHTML(chrome.i18n.getMessage('isUploadingImagesTip'), false);
                        $.ajax({
                            url: self.baseUrl + "/attachment/savemany/",
                            type: "POST",
                            data: formData,
                            processData: false,
                            contentType: false,
                            success: function(data){
                                if(data.error){
                                    //todo: server error, pending note...
                                    console.log('Internal error: ');
                                    console.log(data.error);
                                    if(failCallback){
                                        failCallback(true);
                                    }
									removeFiles();
                                    return;
                                }
                                if(successCallback){
                                    //is replace images in page content
                                    successCallback(data, serializeSucceedImgIndexByOrder, data[0].NoteID);
                                }else{
                                    var d, 
                                    noteId = data[0].NoteID,
                                    realIndex;
                                    for(var i = 0, l = totalImgNum; i < l; i++){
                                        realIndex = serializeSucceedImgIndexByOrder[i];
                                        if(realIndex){
                                            d = data[realIndex];
                                            content += '<img src="' + d.Url + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                            delete serializeSucceedImgIndexByOrder[i];
                                        }else{
                                            content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                        }
                                    }
                                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags, '', noteId);
                                }
								removeFiles();
                            },
                            error: function(jqXHR, textStatus, errorThrown){
                                console.log('xhr error: ')
                                console.log(textStatus)
								removeFiles();
								self.notifyHTML(chrome.i18n.getMessage('UploadImagesFailed'));
                            }
                        });
                    }
                },
                formData = new FormData();
                formData.append('type', maikuNoteOptions.imageAttachment ? 'Attachment' : 'Embedded');
                formData.append('categoryId', msg.categoryId || '');
                formData.append('id', msg.id || '');
                for(var i = 0, l = totalImgNum; i < l; i++){
                    self.downloadImage(imgs[i], i, function(file, idx){
                        serializeSucceedImgNum++;
                        serializeSucceedImgIndex.push(idx);
                        formData.append('file' + idx, file);
						files[idx] = file;
                        checkComplete();
                    }, function(idx){
                        serializeFailedImgNum++;
                        checkComplete();
                    });
                }
            }else{
                saveNormalNote();
            }
        },
        initExtensionConnect: function(){
            var self = this;
            chrome.extension.onConnect.addListener(function(port){
                switch(port.name){
					case 'gethost':
						self.gethostHandlerConnect(port);
						break;
                    case 'savenotefrompopup': 
                        self.savenotefrompopupHandler(port);
                        break;
                    case 'allimages': 
                        self.allimagesHandlerConnect(port);
                        break;
					case 'link':
						self.linkHandlerConnect(port);
						break;
					case 'alllinks':
						self.alllinksHandlerConnect(port);
						break;
					case 'getpagecontent':
						self.getpagecontentConnect(port);
						break;
					case 'maikuclipperisnotready':
						self.maikuclipperisnotreadyHandlerConnect(port);
						break;
                    case 'actionfrompopupinspecotr':
                        self.actionfrompopupinspecotrHandler(port);
                        break;
                    default: 
						break;
                }
            });
        },
		gethostHandlerConnect:function(port){
			var self = this;
			port.onMessage.addListener(function(data){
				maikuNoteUtil.createParticularContextMenu(data.host);
			});
		},
        savenotefrompopupHandler:function(port){
            var self = this;
            port.onMessage.addListener(function(msg){
                var normalSave = function(){
                    self.saveNote(msg.title, msg.sourceurl, msg.notecontent, msg.tags, msg.categoryid, '', '', function(){
                        self.closePopup();
                    });
                }
                if(maikuNoteOptions.serializeImg){
                    var content = $('<div></div>').append(msg.notecontent),
                    imgs = content.find('img'),
                    needReplaceImgs = [],
                    filteredImg = {},
                    filteredImgTitles = [],
                    isToSave = function(url){
                        var suffix = url.substr(url.length - 4);
                        return /^\.(gif|jpg|png)$/.test(suffix);
                    }
                    if(imgs.length > 0){
                        for(var i = 0, img, l = imgs.length, src; i < l; i++){
                            img = imgs[i];
                            src = img.src;
                            if(!isToSave(src)) continue;
                            if(filteredImg[src]) continue;
                            filteredImg[src] = 1;
                            filteredImgTitles.push(img.title || img.alt || '');
                            needReplaceImgs.push(img);
                        }
                        self.saveImgs({
                           imgs: Object.keys(filteredImg),
                           imgTitles: filteredImgTitles,
                           title: msg.title,
                           sourceurl: msg.sourceurl,
                           categoryId: msg.categoryid
                        }, function(uploadedImageData, serializeSucceedImgIndexByOrder, noteId){
                            var realIndex, d;
                            for(var i = 0, l = needReplaceImgs.length; i < l; i++){
                                realIndex = serializeSucceedImgIndexByOrder[i];
                                if(realIndex){
                                    d = uploadedImageData[realIndex];
                                    needReplaceImgs[i].src = d.Url;
                                    delete serializeSucceedImgIndexByOrder[i];
                                }
                            }
                            self.saveNote(msg.title, msg.sourceurl, content.html(), msg.tags, msg.categoryid, noteId, '', function(){
                                self.closePopup();
                            });
                        }, function(){
                            //all images upload failed or serialize failed, just save the clipped content
                            normalSave();
                        });
                    }else{
                        normalSave();
                    }
                }else{
                    normalSave();
                }
            });
        },
        allimagesHandlerConnect:function(port){
            var self = this;
            port.onMessage.addListener(function(msg){
                self.saveImgs(msg);
            });
        },
		linkHandlerConnect: function(port){
			var self = this;
			port.onMessage.addListener(function(msg){
				var content = '<a href="' + msg.linkUrl + '" title="' + msg.title + '">' + msg.text + '</a>';
				self.saveNote(msg.title, msg.sourceurl, content);
			});
		},
		alllinksHandlerConnect: function(port){
			var self = this;
			port.onMessage.addListener(function(msg){
				var content = '',
				links = msg.links;
				for(var i = 0, l = links.length, link; i < l; i++){
					link = links[i];
					content += '<a href="' + link.linkUrl + '" title="' + link.title + '">' + link.text + '</a><br />';
				}
				self.saveNote(msg.title, msg.sourceurl, content);
			});
		},
		getpagecontentConnect: function(port){
			var self = this;
			port.onMessage.addListener(function(msg){
                if(maikuNoteOptions.serializeImg){
                    var content = $('<div></div>').append(msg.content),
                    imgs = content.find('img'),
                    needReplaceImgs = [],
                    filteredImg = {},
                    filteredImgTitles = [],
                    isToSave = function(url){
                        var suffix = url.substr(url.length - 4);
                        return /^\.(gif|jpg|png)$/.test(suffix);
                    }
                    for(var i = 0, img, l = imgs.length, src; i < l; i++){
                        img = imgs[i];
                        src = img.src;
                        if(!isToSave(src)) continue;
                        if(filteredImg[src]) continue;
                        filteredImg[src] = 1;
                        filteredImgTitles.push(img.title || img.alt || '');
                        needReplaceImgs.push(img);
                    }
                    self.saveImgs({
                       imgs: Object.keys(filteredImg),
                       imgTitles: filteredImgTitles,
                       title: msg.title,
                       sourceurl: msg.sourceurl
                    }, function(uploadedImageData, serializeSucceedImgIndexByOrder, noteId){
                        var realIndex, d;
                        for(var i = 0, l = needReplaceImgs.length; i < l; i++){
                            realIndex = serializeSucceedImgIndexByOrder[i];
                            if(realIndex){
                                d = uploadedImageData[realIndex];
                                needReplaceImgs[i].src = d.Url;
                                delete serializeSucceedImgIndexByOrder[i];
                            }
                        }
                        self.saveNote(msg.title, msg.sourceurl, content.html(), '', '', noteId);
                    }, function(){
                        //all images upload failed or serialize failed, just save the page
                        self.saveNote(msg.title, msg.sourceurl, msg.content);
                    });
                }else{
                    self.saveNote(msg.title, msg.sourceurl, msg.content);
                }
			});
		},
		maikuclipperisnotreadyHandlerConnect:function(port){
			var self = this;
			port.onMessage.addListener(function(msg){
				self.notifyHTML(chrome.i18n.getMessage('ClipperNotReady'));
			});
		},
        actionfrompopupinspecotrHandler: function(port){
            var self = this;
            port.onMessage.addListener(function(data){
                //send to popup
				chrome.tabs.sendRequest(port.sender.tab.id, {name: 'actionfrompopupinspecotr', data: data});
			});
        },
        onFileError: function(err){
            for(var p in FileError){
                if(FileError[p] == err.code){
                    console.log('Error code: ' + err.code + 'Error info: ' + p);
                    break;
                }
            }
        },
        writeBlobAndSendFile: function(fs, blob, fileName, successCallback, errorCallback, imgIndex){
            var self = this;
            fs.root.getFile(fileName, {create: true}, function(fileEntry){
                fileEntry.createWriter(function(fileWriter){
                    fileWriter.onwrite = function(e){
                        console.log('Write completed.');
                        fileEntry.file(function(file){
                            successCallback(file, imgIndex);
                        });
                    };
                    fileWriter.onerror = function(e){
                        console.log('Write failed: ' + e.toString());
                    };
                    fileWriter.write(blob);
                }, self.onFileError);
            }, self.onFileError);
        },
        downloadImage: function(url, imgIndex, successCallback, errorCallback){
            var self = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function(e){
                if (this.status == 200){
                    var suffix = url.split('.'),
                    blob = new Blob([this.response], {type: 'image/' + suffix[suffix.length - 1]}),
                    parts = url.split('/'),
                    fileName = parts[parts.length - 1];
                    window.requestFileSystem(TEMPORARY, this.response.byteLength, function(fs){
                        self.writeBlobAndSendFile(fs, blob, fileName, successCallback, errorCallback, imgIndex);
                    }, self.onFileError);
                }
            }
            xhr.onerror = function(){
                console.log('retrieve remote image xhr onerror')
                errorCallback && errorCallback(imgIndex);
            }
            xhr.onabort = function(){
                console.log('retrieve remote image xhr onabort')
                errorCallback && errorCallback(imgIndex);
            }
            xhr.send(null);
        },
        removeFile: function(fileName, fileSize){
            var self = this;
            window.requestFileSystem(TEMPORARY, fileSize, function(fs){
                fs.root.getFile(fileName, {}, function(fileEntry){
                    fileEntry.remove(function() {
                        console.log('File ' + fileName + ' removed.');
                    }, self.onFileError);
                }, self.onFileError);
            }, self.onFileError);
        },
        notify:function(content, lastTime, title, icon){
			//deprecated
            if(!content) return;
            title = title || 'Hi:';
            icon = icon || '../images/icons/48x48.png';
            if(self.notification) self.notification.cancel();
            self.notification = webkitNotifications.createNotification(
                icon,
                title,
                content
            );
            self.notification.show();
            if(lastTime !== false){
                setTimeout(function(){
                    self.notification.cancel();
                }, lastTime || 5000);
            }
        },
		notifyHTML: function(content, lastTime, title){
            if(!content) return;
			var self = this;
			self.notificationData = {
				content: content, 
				title: title || 'Hi:'
			}
			if(self.notification){
				clearTimeout(self.notificationTimer);
				//chrome version below 20 has no such method
				if(chrome.extension.sendMessage){
					chrome.extension.sendMessage({name: 'sendnotification', data: self.notificationData});
				}
			}else{
				self.notification = webkitNotifications.createHTMLNotification('notification.html');
				self.notification.addEventListener('close', function(e){
					self.notification = null;
				});
				self.notification.show();
			}
			if(lastTime !== false){
                self.notificationTimer = setTimeout(function(){
                    self.notification && self.notification.cancel();
                }, lastTime || 5000);
            }
		},
        checkLogin: function(callback){
            var self = this;
            self.getUser(function(user){
                if(!user){
                    chrome.windows.create({
                        url: self.baseUrl + "/login", 
                        type: "popup", 
                        height: 600,
                        width:800,
                        left:0,
                        top:0
                    }, function(win){
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info){
                            if(info.status == 'loading' && id == tabId){
                                self.getUser(function(user){
                                    if(user){
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback(user));
                                    }
                                });
                            }
                        });
                    });
                }else{
                    callback(user);
                }
            });
        },
        checkLogout: function(callback){
            var self = this;
            chrome.cookies.get({url: self.baseUrl, name: ".iNoteAuth"}, function(cookie){
                if(cookie){
                    chrome.windows.create({
                        url: self.baseUrl + "/account/logout", 
                        type: "panel"
                    }, function(win){
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info){
                            if(info.status == 'loading' && id == tabId){
                                chrome.cookies.get({url: self.baseUrl, name: ".iNoteAuth"}, function(cookie){
                                    if(!cookie){
                                        self.userData = null;
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback);
                                    }
                                });
                            }
                        });
                    });
                }else{
                    callback();
                }
            });
        },
        initManagement:function(){
            // uninstall old version
            chrome.management.getAll(function(exs){
                for(var i = exs.length - 1; i > 0; i--){
                    if(exs[i].id == "mfhkadpfndbefbpibomdbdbnnpmjiaoh"){
                        chrome.management.uninstall("mfhkadpfndbefbpibomdbdbnnpmjiaoh");
                    }
                    if(exs[i].id == "blabbhjfbhclflhnbbapahfkhpcmgeoh"){
                        chrome.management.uninstall("blabbhjfbhclflhnbbapahfkhpcmgeoh");
                    }
                }
            });
        },
		getTitleByText: function(txt){
			//todo
			var self = this,
			finalTitle = '';
            if(txt.length <= 100) return txt;
            if(txt.length > 0){
                var t = txt.substr(0, 100), l = t.length, i = l - 1, hasSpecialChar = false;
                //9 : HT 
                //10 : LF 
                //44 : ,
                //65292 : ，
                //46 :　．
                //12290 : 。
                //59 : ;
                //65307 : ；
                while(i >= 0){
                    if(/^(9|10|44|65292|46|12290|59|65307)$/.test(t.charCodeAt(i))){
                        hasSpecialChar = true;
                        break;
                    }else{
                        i--;
                    }
                }
                hasSpecialChar ? (t = t.substr(0, i)) : '';
                i = 0;
                l = t.length;
                while(i < l){
                    if(/^(9|10)$/.test(t.charCodeAt(i))){
                        break;
                    }else{
                        finalTitle += t.charAt(i);
                        i++;
                    }
                }
            }
            finalTitle = finalTitle.trim();
			return finalTitle.length > 0 ? finalTitle : '[未命名笔记]';
		},
        jQuerySetUp:function(){
            $.ajaxSetup({
                dataType: 'text',
                cache: false,
                dataFilter: function(data){
                    data = $.parseJSON(data.substr(9));//remove 'while(1);'
                    return data.success ? data.data : {error: data.error};
                }
            });
        },
		initTabEvents: function(){
			var self = this;
			chrome.tabs.onActivated.addListener(function(info, tab){
				//console.log('tab changed');
				chrome.tabs.executeScript(null, {code: "maikuClipper.getHost();"});
			});
			chrome.tabs.onUpdated.addListener(function(id, info, tab){
				if(info.status == 'loading'){
					//console.log('tab updated');
					maikuNoteUtil.createParticularContextMenu(tab.url.split('/')[2]);
				}
				if(info.status == 'complete'){
					//maybe login, maybe logout, update user data
					//listen any page, since user can login from any page, not just http://note.sdo.com or http://passport.note.sdo.com
					chrome.cookies.get({url: self.baseUrl, name: '.iNoteAuth'}, function(cookie){
						if(cookie){
							if(!self.userData){
								self.getUser(function(){});
							}
						}else{
							self.userData = null;
						}
					});
				}
			});
		},
		initExtensionRequest: function(){
			var self = this;
			chrome.extension.onRequest.addListener(function(request, sender){
				if(!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
				switch(request.name){
					case 'getuser':
						self.getuserHandlerRequest(sender, request.refresh);
						break;
                    case 'popuplogin':
                        self.checkLogin(function(user){
                            chrome.tabs.sendRequest(sender.tab.id, {name: 'userlogined', user: user, settings: self.getSettings()});
                        });
                        break;
                    case 'popuplogout':
                        self.checkLogout(function(){
                            chrome.tabs.sendRequest(sender.tab.id, {name: 'userlogouted'});
                        });
                        break;
					case 'clicksavebtnwithoutloginpopup':
						//popup, click save button, button user has not logined
						self.checkLogin(function(user){
							chrome.tabs.sendRequest(sender.tab.id, {name: 'clicksavebtnafteruserloginedpopup', user: user, settings: self.getSettings()});
						});
					case 'setdefaultcategory':
						//change category,store it
						self.setMaikuOption('defaultCategory', request.defaultCategory);
						break;
                    case 'setautoextract':
						//change auto extract content option, store it
						self.setMaikuOption('autoExtractContent', request.value);
						break;
                    case 'createoptionstab':
                        chrome.tabs.create({
                            url: chrome.i18n.getMessage('helperUrl')
                        });
                        break;
					default:
						break;
				}
			});
		},
		getuserHandlerRequest: function(sender, refresh){
			var self = this;
			if(refresh){
				//user refresh infomation
				self.userData = null;//this will force to fetch newest info
			}
            self.getUser(function(user){
                chrome.tabs.sendRequest(sender.tab.id, {name: 'getuser', user: user, settings: self.getSettings(), refresh: refresh});
            });
		},
        getUser: function(callback){
            var self = this;
            if(self.userData){
                callback(self.userData);
                return;
            }
            chrome.cookies.get({url: self.baseUrl, name: '.iNoteAuth'}, function(cookie){
                if(cookie){
                    //user is login, get user from localStorage or send request to get user
                    $.ajax({
                        url: self.baseUrl + '/plugin/clipperdata',
                        success: function(data){
                            if(data.error){
                                //todo
                                callback(cookie);
                                return;
                            }
                            self.userData = data;
                            callback(data);
                        },
                        error: function(){
                            callback(cookie);
                        }
                    });
                }else{
                    callback();
                }
			});
        },
        setMaikuOption: function(key, value){
			var self = this;
            self[key] = value;
            maikuNoteOptions[key] = value;
        },
        getSettings: function(){
            var self = this;
            self.settings = {
                serializeImg: maikuNoteOptions.serializeImg,
                defaultCategory: maikuNoteOptions.defaultCategory,
                autoExtractContent: maikuNoteOptions.autoExtractContent
            }
            return self.settings;
        },
		removeFileSystems: function(){
			//every time browser booted, remove files
			chrome.browsingData.removeFileSystems({});
		},
        initOmnibox: function(){
            var self = this;
            chrome.omnibox.onInputEntered.addListener(function(text){
                if(text == 'popup'){
                    self.createPopup();
                }
            });
        }
    };
    Object.defineProperties(maikuNote, {
        baseUrl:{
            value: chrome.i18n.getMessage('baseUrl'),
            writable: false
        }
    });
	$(function(){
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
        maikuNoteOptions = window.maikuNoteOptions;
		maikuNote.init();
	});
})(jQuery);