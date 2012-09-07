//@huntbao @mknote
//All right reserved
(function(){
    var maikuNotePopup = {
        init: function(){
            var self = this;
            self.addEvents();
			self.initExtensionRequest();
			self.initCategories();
			self.initTags();
			self.getUser();
        },
        addEvents: function(){
            var self = this;
            $('#optionbtn').click(function(e){
                chrome.extension.sendRequest({name: 'createoptionstab'});
                return false;
            });
            self.title = $('#titleinp');
            var mouseDowned,
            startPageY,
            noteContent = $('#notecontent'),
            body = $('body'),
            initTaHeight = parseInt(noteContent.css('height')),
            changeStep;
            $(document).mousemove(function(e){
				if(mouseDowned){
					changeStep = e.pageY - startPageY;
					noteContent.css('height', initTaHeight + changeStep);
					parent.postMessage({name: 'changeheightfrommaikupopup', param: changeStep}, '*');
				}
            }).bind('mouseup', function(e){
                mouseDowned = false;
                body.removeClass('not-selectable');
                noteContent.removeClass('not-selectable');
                initTaHeight = parseInt(noteContent.css('height'));
                parent.postMessage({name: 'stopchangeheightfrommaikupopup'}, '*');
            }).mouseenter(function(){
                parent.postMessage({name: 'hidemaskfrommaikupopup'}, '*');
            });
            $('#resizer').mousedown(function(e){
                mouseDowned = true;
                body.addClass('not-selectable');
                noteContent.addClass('not-selectable');
                startPageY = e.pageY;
            });
            $('#closebtn').click(function(e){
                parent.postMessage({name: 'closefrommaikupopup'}, '*');
                return false;
            });
			$('#resetbtn').click(function(e){
				noteContent.html('').focus();
                self.title.val('');
                parent.postMessage({name: 'resetfrommaikupopup'}, '*');
			});
			self.saveNote = function(){
				if(self.isLogin){
                    noteContent.find('div[mkclip=true]').removeAttr('id').removeAttr('mkclip');
                    parent.postMessage({
                        name: 'savenotefrommaikupopup',
                        notedata: {
                            notecontent: noteContent.html(),
                            categoryid: self.displayName.data('cateid'),
                            tags: self.tagHandlerEl.tagHandler('getTags').join(','),
                            title: self.title.val() || noteContent.text().trim()
                        }
                    }, '*');
                }else{
                    chrome.extension.sendRequest({name: 'clicksavebtnwithoutloginpopup'});
                }
			}
            $('#savebtn').click(function(e){
                self.saveNote();
            });
            var mkbmUtils = $('#mkbm-utils');
            self.autoExtractContent = mkbmUtils.find('.mkbm-auto-extract .mkbm-util-icon');
            mkbmUtils.delegate('.mkbm-util-item', 'click', function(e){
                var t = $(this);
                if(t.is('.mkbm-auto-extract')){
					if(self.autoExtractContent.is('.mkbm-enable')){
                        self.autoExtractContent.removeClass('mkbm-enable').addClass('mkbm-disabled').attr('title', chrome.i18n.getMessage('AutoExtractContentDisabled'));
                        parent.postMessage({name: 'disablemouseselectfrommaikupopup'}, '*');
                        chrome.extension.sendRequest({name: 'setautoextract', value: false});
                    }else{
                        self.autoExtractContent.removeClass('mkbm-disabled').addClass('mkbm-enable').attr('title', chrome.i18n.getMessage('AutoExtractContentEnabled'));
                        parent.postMessage({name: 'enablemouseselectfrommaikupopup'}, '*');
                        chrome.extension.sendRequest({name: 'setautoextract', value: true});
                    }
                }else if(t.is('.mkbm-panel-position')){
                    if(t.data('panel-position') == 'bottom'){
                        parent.postMessage({name: 'gotopfrommaikupopup'}, '*');
                        t.data('panel-position', 'top').find('.mkbm-util-icon').removeClass('mkbm-down');
                    }else{
                        parent.postMessage({name: 'gobottomfrommaikupopup'}, '*');
                        t.data('panel-position', 'bottom').find('.mkbm-util-icon').addClass('mkbm-down');
                    }
                }else if(t.is('.mkbm-refresh-info')){
					self.getUser(true);
				}else if(t.is('.mkbm-mouse-select')){
                    if(t.data('isdisabled') == 'true'){
                        parent.postMessage({name: 'showinspectorfrommaikupopup'}, '*');
                        t.data('isdisabled', 'false')
                        .find('.mkbm-util-icon')
                        .removeClass('mkbm-disabled')
                        .attr('title', communicationProxy.clipper.i18n.getMessage('DisableMouseSelect'));
                    }else{
                        parent.postMessage({name: 'hideinspectorfrommaikupopup'}, '*');
                        t.data('isdisabled', 'true')
                        .find('.mkbm-util-icon')
                        .addClass('mkbm-disabled')
                        .attr('title', communicationProxy.clipper.i18n.getMessage('EnableMouseSelect'));
                    }
                }
            });
            self.noteContent = noteContent;
        },
        addNode: function(node){
            var self = this;
            self.noteContent.append(node).scrollTop(self.noteContent.prop('scrollHeight'));
        },
		initExtensionRequest: function(){
			var self = this;
			chrome.extension.onRequest.addListener(function(request, sender, sendResponse){
				if(!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
				switch(request.name){
					case 'getuser':
						//first open popup, get user status
						self.getuserHandlerRequest(request.user, request.settings, request.refresh);
						break;
                    case 'userlogined':
						//user click the bottom left btn to login
                        self.userloginedHandlerRequest(request.user, request.settings);
                        break;
                    case 'userlogouted':
						//user click the bottom left btn to logout
                        self.userlogoutedHandlerRequest();
                        break;
					case 'clicksavebtnafteruserloginedpopup':
						//user is not login and click save button, now callback method is called and user has logined
						self.userloginedHandlerRequest(request.user, request.settings);
						self.saveNote();
						break;
					case 'actionfrompopupinspecotr':
                        self.actionfrompopupinspecotrHandler(request.data);
						break;
					default:
						break;
				}
			});
		},
		getuserHandlerRequest:function(user, settings, refresh){
            var self = this;
			if(user){
                self.userloginedHandlerRequest(user, settings);
            }else{
                self.userlogoutedHandlerRequest();
            }
            if(refresh) return;//user refresh infomation, no need to create inspector again
            self.createInspector(settings.autoExtractContent);
            if(settings.autoExtractContent == false){
                self.autoExtractContent.removeClass('mkbm-enable').addClass('mkbm-disabled').attr('title', chrome.i18n.getMessage('AutoExtractContentDisabled'));
            }
		},
        createInspector: function(autoExtractContent){
            var self = this;
            parent.postMessage({name: 'createinspectorfrommaikupopup', autoExtractContent: autoExtractContent}, '*');
        },
        userloginedHandlerRequest: function(userData, settings){
            var self = this;
            $('#username').html(userData.user.NickName)
            .attr('title', chrome.i18n.getMessage('LoginMaiku'))
            .attr('href', chrome.i18n.getMessage('baseUrl'))
            .addClass('logined')
            .next().show().unbind('click').click(function(e){
                chrome.extension.sendRequest({name: 'popuplogout'});
                return false;
            });
            self.setCategories(userData, settings);
            self.isLogin = true;
        },
        userlogoutedHandlerRequest: function(){
            var self = this;
			self.clearCategories();
            $('#username').html(chrome.i18n.getMessage('NotLoginMaiku'))
            .attr('title', chrome.i18n.getMessage('NotLoginMaikuTip'))
            .removeClass('logined')
            .unbind('click').click(function(e){
                chrome.extension.sendRequest({name: 'popuplogin'});
                return false;
            }).next().hide();
            self.isLogin = false;
        },
        initCategories: function(){
            var self = this;
            self.mkbmExtra = $('#mkbm-extra');
            var category = self.mkbmExtra.find('.mkbm-category');
            self.displayName = category.find('.mkbm-category-show span');
            self.dropList = category.find('.mkbm-category-select');
			self.displayNameWrap = self.displayName.parent();
			self.displayNameWrap.data('title', self.displayNameWrap.attr('title'));
            self.displayNameWrap.click(function(e){
				if(!self.isLogin) return false;
                self.dropList.show();
                $(document).one('click', function(e){
                    self.dropList.hide();
                });
                return false;
            });
            self.dropList.delegate('li', 'click', function(e){
                var t = $(this);
                self.displayName.html(t.html()).data('cateid', t.attr('cateid'));
				chrome.extension.sendRequest({name: 'setdefaultcategory', defaultCategory: t.attr('cateid')});
            });
        },
        setCategories: function(userData, settings){
            var self = this,
			privateCategories = userData.categories.pri, 
			publicCategories = userData.categories.pub,
			defaultCategory = settings.defaultCategory,
			foundCategory = '',
			displayName = '默认分类',
			tStr = '<li class="mkbm-category-title">私人分类</li>',
            genStrByCates = function(cates){
                for(var i = 0, l = cates.length, cate; i < l; i++){
                    cate = cates[i];
                    if(cate.ParentID){
                        tStr += '<li class="mkbm-child-category" cateid="' + cate.NoteCategoryID + '">' + cate.DisplayName + '</li>';
                    }else{
                        tStr += '<li cateid="' + cate.NoteCategoryID + '">' + cate.DisplayName + '</li>';
                    }
					if(!foundCategory && (cate.NoteCategoryID == defaultCategory)){
						displayName = cate.DisplayName;
						foundCategory = defaultCategory;
					}
                }
            }
            genStrByCates(privateCategories);
            tStr += '<li class="mkbm-category-title">公开分类</li>';
            genStrByCates(publicCategories);
            self.dropList.html(tStr);
			self.displayNameWrap.attr('title', '');
			self.displayName.html(displayName).data('cateid', foundCategory);
        },
		clearCategories: function(){
			var self = this;
			self.dropList.html('');
			self.displayName.html('默认分类');
			self.displayNameWrap.attr('title', self.displayNameWrap.data('title'));
		},
        initTags: function(){
            var self = this,
            tags = self.mkbmExtra.find('.mkbm-tags'),
			tagHandlerEl = tags.find('.mkbm-tagHandler-init'),
            tagsShowTimeout;
            tagHandlerEl.tagHandler({
                className: 'mkbm-taghandler',
                onAdd: function(){
                    tags.scrollTop(9999999);
                },
                onFocus: function(){
                    if(tags.attr('class').indexOf('mkbm-tags-expand') == -1){
                        tags.addClass('mkbm-tags-expand mkbm-focus');
                    }
                },
                onBlur: function(){
                    if(tags.attr('class').indexOf('mkbm-tags-expand') != -1){
                        tags.removeClass('mkbm-tags-expand mkbm-focus');
                    }
                }
            });
            tags.bind('mouseenter', function(){
                tagsShowTimeout = setTimeout(function(){
                    tags.find('.tagInputField').focus();
                    tags.scrollTop(9999999);
                    tags.addClass('mkbm-tags-expand mkbm-focus');
                }, 300);
            });
            tags.bind('mouseleave', function(){
                clearTimeout(tagsShowTimeout);
                tags.find('.tagInputField').blur();
                tags.scrollTop(0);
                tags.removeClass('mkbm-tags-expand mkbm-focus');
            });
			self.tagHandlerEl = tagHandlerEl;
        },
		getUser: function(refresh){
			//send request to backgroun page
			chrome.extension.sendRequest({name: 'getuser', refresh: refresh});
		},
        actionfrompopupinspecotrHandler: function(data){
            var self = this;
            if(data.add){
                //add content
                self.addNode($('<div mkclip="true" id="' + data.uid + '"></div>').append(data.content));
                if(data.title){
                    //for auto extract content
                    self.title.val(data.title);
                }
            }else{
                //remove content by uid
                $('#' + data.uid).remove();
            }
        }
    }
    $(function(){
        maikuNotePopup.init();
    });
})();