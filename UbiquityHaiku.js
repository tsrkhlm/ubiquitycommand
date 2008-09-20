//はてなハイククライアント
//
//_loadCountで読み込みタイムライン数設定
//
//TODO:HotKeywords:RecentEntries:ユーザーのフォロー:キーワードのフォロー:fotolife記法対応

var noun_type_HaikuKeywords ={
  _name: "keyword",
  keyArr:[""],

  suggest: function( text, html ) {
    
    var suggestions  = [];

    for ( var i in this.keyArr ) {
      if ( this.keyArr[i].match( "^" + text ) ) {
        suggestions.push( CmdUtils.makeSugg( this.keyArr[i] ) );
      }
    }

    return suggestions;
  }
}

var noun_type_HaikuStatus ={
  _name: "user",
  userArr:[""],

  suggest: function( text, html ) {
    
    var suggestions  = [];

    for ( var status in this.userArr ) {
      if ( status.match( "^" + text ) ) {
        suggestions.push( CmdUtils.makeSugg( status ) );
      }
    }

    return suggestions;
  }
}

CmdUtils.CreateCommand({
  name: "H:post",
  homepage: "http://d.hatena.ne.jp/Lhankor_Mhy/",
  author: { name: "Lhankor_Mhy", email: "tsrkhlm@gmail.com"},
  description: "はてなハイククライアント",

  takes: {status: noun_arb_text},
  modifiers: {to: noun_type_HaikuKeywords ,re: noun_type_HaikuStatus},
  
  initializer:function(pBlock){
    this.TLstatus = "loading";
    pBlock.innerHTML = "following timeline ...";

    var userName = "";
    var passWord = "";
    
    jQuery.ajax({
      async: false,
      type: 'GET',
      url: 'http://h.hatena.ne.jp/api',
      data: {},
      dataType: 'text',
      error: function() {},
      success: function(res) {
        if (res.match(/https:\/\/www\.hatena\.ne\.jp\/(.*?)\/config\/mail\/upload/)) userName = RegExp.$1;
        if (res.match(/type="text" value="(.*?)" readonly="readonly"/)) passWord = RegExp.$1;
      }
    });//ID・パスワード取得

    var doc = CmdUtils.getDocumentInsecure();
    var Obj = this;
    
    var pTemplate = '\
      <p id="${id}" class="haikuEntry"><a href="${user.url}">\
      <img src="${user.profile_image_url}" width="32px" height="32px"/></a>\
      <span style="text-decoration:underline;color:#fe0"><a href="${keyURL}">${key}</a></span>\
      <img src="http://b.hatena.ne.jp/images/bstar.gif" class="addStar"/>\
      <span id="star${id}">${favorited}</span><br/>\
      {if in_reply_to_status_id != 0}<a href="http://h.hatena.ne.jp/${in_reply_to_user_id}/${in_reply_to_status_id}"><img src="http://h.hatena.ne.jp/images/icon-replylink.gif"/></a>{/if}\
      ${text}\
      <div style="text-align:right;font-size:xx-small;">posted by<a href="${user.url}">\${user.name}</a>\
      <a href="${link}">:${created_at}</a></div></p>';
      
    var URL = "http://h.hatena.ne.jp/api/statuses/friends_timeline.json?count=" + this._loadCount;
    jQuery.ajax({
      type: 'GET',
      url: URL,
      data: {},
      dataType: 'json',
      username: userName,
      password: passWord,
      error: function() {},
      success: function(res) {
        var TLText = "";
        var userArr = new Array();
        var star = '<img src="http://s.hatena.ne.jp/images/star.gif"/>'
        for (var i in res ){
          var txtArr = res[i].text.split("=");
          res[i].key = txtArr[0];
          res[i].keyURL = "http://h.hatena.ne.jp/keyword/" + encodeURIComponent(txtArr[0]);
          res[i].text = txtArr.slice(1).join("=");//キーワード・本文切り離し
          var stars = "";
          for (var s=1; s<= res[i].favorited; s++) stars += star;
          res[i].favorited = stars;//favoritedをスター画像に差し替え
          TLText += CmdUtils.renderTemplate(pTemplate, res[i]);
          userArr[res[i].user.name + ":" + res[i].text] = res[i].id;
        }
        TLText = TLText.replace(/\r\n/g,'<br/>');//改行タグ置換
        TLText = '<style>img{border:0px;}</style><div style="height:400px;overflow:scroll;padding:5px;">'+TLText.replace(/(http:\/\/f.hatena.ne.jp\/images\/fotolife[\w\/\.]*)/g,'<br/><img src="$1"/><br/>') + '</div>';//フォトライフURL置換+ラッピング
        Obj.TLObj = jQuery(doc.createElement("div")).html(TLText);//jQuery("<div></div>")がエラーになる...
        jQuery(".addStar",Obj.TLObj).click(function(e){
          var statusId = e.target.parentNode.id;
          jQuery.ajax({
            type: 'POST',
            url: 'http://h.hatena.ne.jp/api/favorites/create/' + statusId + '.json',
            data: {},
            dataType: 'json',
            error: function() {displayMessage('スターできません')},
            success: function() {jQuery('#star' + statusId,Obj.TLObj).append('<img src="http://s.hatena.ne.jp/images/star.gif"/>')}
          });
        });//addStarイベント設定
        jQuery(pBlock).replaceWith(Obj.TLObj);
        Obj.modifiers.re.userArr = userArr;//リプライモディファイア書き換え
      }
    });

    URL = "http://h.hatena.ne.jp/api/statuses/keywords.json";
    var keyArr = new Array();
    jQuery.get( URL, {}, function(res) {
        for (var i in res){
          keyArr[i] = res[i].title;
        }
        Obj.modifiers.to.keyArr = keyArr;//キーワードモディファイア書き換え
    }, "json")
  },

  TLObj: "",
  TLstatus: "unload",
  _loadCount: 10,
  
  
  preview: function( pBlock, directObj ) {
    if (this.TLstatus == "unload") {
      //CmdUtils.log(this.TLstatus);
      this.initializer(pBlock ,this);//タイムラインのイニシャライズ
    }else{
      jQuery(pBlock).replaceWith(this.TLObj);
    }
  },
  
  execute: function(statusText ,mods) {
    if(statusText.text.length < 1) {
      displayMessage("無言のハイクはできません");
      return;
    }
    
    var updateUrl = "http://h.hatena.ne.jp/api/statuses/update.json";
    var replyTo = (mods.re.text) ? this.modifiers.re.userArr[mods.re.text] : "";
    var toKeyword = (mods.to.text) ? mods.to.text : "";
    var updateParams = {
      status: statusText.text,
      keyword: toKeyword,
      source: "Ubiquity",
      in_reply_to_status_id: replyTo
    };
    
    jQuery.ajax({
      type: "POST",
      url: updateUrl,
      data: updateParams,
      dataType: "json",
      error: function() {
        displayMessage("ハイクできません");
      },
      success: function() {
        displayMessage("ハイクしました");
      }
    });
  }
});
