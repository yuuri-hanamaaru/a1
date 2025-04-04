(function() {
    'use strict';
    
    ////
    // 共通処理
    ////
    
    // Seesaa Wiki以外では実行しない
    if (location.host != "seesaawiki.jp") return;
    
    // 拡張機能が無効化されていたら実行しない
    const is_disabled = !!localStorage.getItem("extension_disabled");
    if (is_disabled) return;
    
    // Wiki IDを取得
    const [wiki_id, rest_path] = location.pathname.split(/^\/(?:w\/)?([^\/]+)/).slice(1);
    
    // ページ種別を判定
    const is_article_page = rest_path.startsWith("/d/") || rest_path === "/";
    const is_edit_page = rest_path.startsWith("/e/");
    const is_comment_page = rest_path.startsWith("/comment/");
    const is_list_page = rest_path.startsWith("/l/");
    const is_diff_page = rest_path.startsWith("/diff/");
    const is_history_page = rest_path.startsWith("/history/");
    const is_version_page = rest_path.startsWith("/dv/");
    const is_members_page = rest_path.startsWith("/members/");
    const is_member_history_page = rest_path.startsWith("/r/");
    const is_bbs_page = rest_path.startsWith("/bbs/");
    const is_search_page = rest_path.startsWith("/search");
    
    // スマホモードの判定
    const mobile_layout = !!document.head.querySelector("meta[name='format-detection']");
    
    // 実験モードの確認・切り替え
    let is_experimental_enabled = !!localStorage.getItem("experimental_mode");
    (function() {
        if (is_experimental_enabled) {
            console.log("experimental mode: on");
        }
        function checkExperimental() {
            let changed = false;
            if (location.hash === "#enable-experimental") {
                is_experimental_enabled = true;
                changed = true;
            } else if (location.hash === "#disable-experimental") {
                is_experimental_enabled = false;
                changed = true;
            }
            if (changed) {
                console.log("experimental mode: " + (is_experimental_enabled ? "on" : "off"));
                history.replaceState(null, null, location.pathname + location.search);
                if (is_experimental_enabled) {
                    localStorage.setItem("experimental_mode", "true");
                } else {
                    localStorage.removeItem("experimental_mode");
                }
            }
        }
        window.addEventListener("hashchange", function(e) {
            checkExperimental();
        });
        checkExperimental();
    })();
    
    // 各画面に魔改造を適用
    if (is_article_page) {
        window.addEventListener("DOMContentLoaded", function() {
            setupStripedTable();
            setupTableFilter();
            setupScrollableTable();
            setupSongListConverter(); // 入力補助ツールページ
            setupRegexReplacer(); // 入力補助ツールページ
            setupAutoFilter(); // 歌唱楽曲一覧ページなど
            if (!mobile_layout) {
                setupTableFilterGenerator(); // 右メニュー
            }
        });
    
    } else if (is_edit_page) {
        // PC版のみ適用
        if (is_experimental_enabled && !mobile_layout) {
            window.addEventListener("DOMContentLoaded", function() {
                setupEditingTools();
                setupSyntaxChecker();
            });
        }
    }
    
    ////
    // ストライプ表示機能 class="stripe" (記事画面)
    ////
    
    function setupStripedTable() {
    
        // ストライプ表示を更新するやつ
        $("table.stripe").on("update-stripe", function(){
            $(this).find("> tbody > tr").filter(":visible")
                .filter(':even').removeClass("even").addClass("odd").end()
                .filter(':odd').removeClass("odd").addClass("even");
        });
    
        // ストライプ適用
        $("table.stripe").trigger("update-stripe");
    
        // フィルター適用時に自動更新
        $("table.stripe.filter").on("change", function(){
            $(this).trigger("update-stripe");
        });
    
    } // setupStripedTable
    
    ////
    // フィルター機能の改善 class="filter regex" (記事画面)
    ////
    
    function setupTableFilter() {
    
        // テーブルにイイカンジのフィルター機能を搭載
        $("table.filter").each(function(i){
            const input = $("#table-filter-"+i);
            const table = $(this);
    
            // フィルター入力欄とテーブルを紐づけ
            input.data("target", table);
    
            // オリジナルの入力監視機能を無効化
            input.unbind("focus").blur().unbind("blur");
    
            // 自前の入力監視・フィルター適用機能で上書き
            input.textChange({
                change: function(self) {
                    $(self).trigger("apply");
                },
            });
            input.change(function(){
                $(this).trigger("apply");
            });
    
        });
    
        //正規表現・大小区別に応じたマッチング関数を生成するやつ
        const gen_tester = (pattern, ignore, regex)=>{
            if (regex) {
                try {
                    const re = new RegExp(pattern, (ignore ? "i" : ""));
                    return (t)=>re.test(t);
                } catch (e) {
                    return null;
                }
            } else {
                if (ignore) {
                    const sub = pattern.toLowerCase();
                    return (t)=>t.toLowerCase().includes(sub);
                } else {
                    return (t)=>t.includes(pattern);
                }
            }
        };
    
        //正規表現対応のフィルター適用処理
        $("input[id^='table-filter-']").on("apply", function(){
            const pattern = $(this).val();
            const prev = $(this).data("prev");
            if (prev == pattern) return;
            $(this).data("prev", pattern);
    
            const table = $(this).data("target");
    
            // 設定に応じたマッチング関数を用意
            const is_regex = table.hasClass("regex");
            const ignore_case = true; // 一律で大小区別なし
            const test = gen_tester(pattern, ignore_case, is_regex);
            if (test == null) return;
    
            // フィルター適用
            const rows = table.find("> tbody > tr");
            rows.each((i,row)=>{
                $(row).toggle(test($(row).text()));
            });
    
            // ストライプ更新など
            table.trigger("change");
        });
    
    } // setupTableFilter
    
    ////
    // 縦横スクロールテーブル class="scrollX scrollY" (記事画面)
    ////
    
    function setupScrollableTable() {
    
        $('table[id*="content_block_"].scrollX').wrap('<div class="x-scroller">');
        $('table[id*="content_block_"].scrollY').wrap('<div class="y-scroller">');
    
    } // setupScrollableTable
    
  //----------
// 歌唱楽曲リスト変換ツール (入力補助ツールページ)
//----------

setupSongListConverter () {

    const title = document.title
    const boxes = {}

    initSongListConverter.call(this)

    function initSongListConverter () {
        const userArea = document.querySelector('div.user-area')
        // 見出しを基準にする。見つからなければ適用なし
        const headings = userArea.querySelectorAll('div.title-1')
        const converterHeading = Array.prototype.find.call(headings, (heading) => {
            const text = heading.textContent
            // ホロライブ、どっとライブ、もちぷろ、のりプロ、しぐれうい、ホロスターズ
            return text.match('歌リスト変換書き換え簡略版')
        })
        if (!converterHeading) {
            return
        }

        // 基準の見出し以降からテキストボックスを8つ見つける。見つからなければ適用なし
        const textareas = userArea.querySelectorAll('textarea.PLAIN-BOX')
        const firstBoxIndex = Array.prototype.findIndex.call(textareas, (textarea) => {
            return (WikiExtension.compareNodeOrder(textarea, converterHeading) > 0)
        })
        if (firstBoxIndex < 0 || firstBoxIndex + 7 >= textareas.length) {
            return
        }

        boxes.name = textareas[firstBoxIndex]
        boxes.roman = textareas[firstBoxIndex + 1]
        boxes.date = textareas[firstBoxIndex + 2]
        boxes.cast = textareas[firstBoxIndex + 3]
        boxes.url = textareas[firstBoxIndex + 4]
        boxes.songs = textareas[firstBoxIndex + 5]
        boxes.castOut = textareas[firstBoxIndex + 6]
        boxes.songsOut = textareas[firstBoxIndex + 7]

        if (title.includes('編集用_入力補助ツール')) {
            window.setInterval(convertSongList.bind(this), 1000)
        }
    }

    // タイムスタンプの形式チェック
    function extractHMSformat(timeStr) {
      const regex = /(\d{1,2}:\d{1,2}(?::\d{1,2})?)/;
      const match = timeStr.match(regex);
      if (match) {
        return match[1];
      }
      return null;
    }

    // タイムスタンプの形式チェック
    function correntHMSformat(hmsStr) {
      if (!hmsStr) {
        return null;
      }
      let seconds = ((hmsStr) => {
        const parts = hmsStr.split(':').map(Number).reverse();
        const multipliers = [1, 60, 3600];  // seconds, minutes, hours
        return parts.reduce((acc, part, index) => acc + part * multipliers[index], 0);
      })(hmsStr);
      const hours = Math.floor(seconds / 3600);
      seconds -= hours * 3600;
      const minutes = Math.floor(seconds / 60);
      seconds -= minutes * 60;
      return `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`.replace(/00[hms]/g, '');
    }

    // 歌唱楽曲リスト変換処理
    function convertSongList () {
        const name = boxes.name.value.replace(/\n/g, '')
        const roman = boxes.roman.value.replace(/\n/g, '')
        const dateSlash = boxes.date.value.replace(/\n/g, '')
        const castTitle = boxes.cast.value.replace(/\n/g, '')
        const url = boxes.url.value.replace(/\n/g, '')
        const songs = boxes.songs.value.split('\n')
        const datePlain = dateSlash.replace(/\//g, '')
        const dateDot = dateSlash.replace(/\//g, '.')
        const castAnchor = roman + datePlain
        const dataAnchor = `data_${roman}${datePlain}`
        const escapedCastTitle = WikiExtension.escapeWikiComponents(castTitle)

        const songRows = []

        for (const line of songs) {
          if (!line) continue
          const hmsStr = extractHMSformat(line);
          const timestamp = correntHMSformat(hmsStr);

          const songName = !hmsStr ? line : line.split(hmsStr).pop().replace(/^[ 　]+|[ 　]+$/g, '');
          const escapedSongName = WikiExtension.escapeWikiComponents(songName)
          const songUrl = timestamp ? `[[${escapedSongName}>>${url}&t=${timestamp}]]` : `[[${escapedSongName}>>${url}]]`;
          const index = ('00' + (songRows.length + 1)).slice(-3)
          const songRow = [
            name,
            `[[${dateDot}生>#${castAnchor}]]-${index}`,
            songUrl,
            ''
          ]
          if (songRows.length === 0) {
            songRow[1] += `&aname(${dataAnchor})`
          }
          songRows.push('|' + songRow.join('|') + '|')
        }

        const castRow = [
            name,
            `[[${dateSlash}>#${dataAnchor}]]&aname(${castAnchor})`,
            `[[${escapedCastTitle}>>${url}]]`,
            String(songRows.length)
        ]

        boxes.castOut.value = '|' + '|' + '|'
        boxes.songsOut.value = songRows.join('\n')

        boxes.castOut.readOnly = true
        boxes.songsOut.readOnly = true
    }

} // setupSongListConverter
    ////
    // 正規表現置換ツール (入力補助ツールページ)
    ////
    
    function setupRegexReplacer() {
    
        initRegexReplacer();
    
        function initRegexReplacer() {
            let links = document.querySelectorAll('a');
            links.forEach(function(link) {
                if (link.getAttribute("href") == "#regreplace") {
                    link.addEventListener('click', regReplace, false);
                }
            });
        }
    
        //正規表現変換
        //textArea[8-11]を使用
        //入力8-10→出力11
        function regReplace() {
            let textArea = document.getElementsByClassName("PLAIN-BOX");
            let pattern = textArea[9].value;
            let convert = textArea[10].value;
            let after = textArea[8].value.replace(new RegExp(pattern,'g'),convert);
            textArea[11].value = after;
        }
    
    } // setupRegexReplacer
    
    ////
    // 自動絞り込み (歌唱楽曲一覧ページなど)
    ////
    
    function setupAutoFilter() {
    
        applyFilters();
    
        function applyFilters() {
            const title = document.title;
            const params = getParams(true);
            const keyword = params.get('keyword');
    
            //どっとライブ
            if (wiki_id === "siroyoutuber") {
                if (title.match(/^(?!どっとライブ)(.+?)\s*【歌唱楽曲一覧】/)) {
                    const name = RegExp.$1;
                    applyFilter(2, name); //簡易
                    applyFilter(3, name); //外部
                    applyFilter(4, name); //歌ってみた
                }
            }
            //ホロライブ
            if (wiki_id === "hololivetv") {
                if (title.match(/^(?!ホロライブ)(.+?)\s*【歌唱楽曲一覧】/)) {
                    const name = RegExp.$1;
                    applyFilter(2, name); //オリジナルソング
                    applyFilter(3, name); //歌ってみた
                }
            }
            //のりプロ
            if (wiki_id === "noriopro") {
                if (title.match(/^(?!のりプロ)(.+?)\s*【歌唱楽曲一覧】/)) {
                    const name = RegExp.$1;
                    applyFilter(0, name); //オリジナルソング
                    applyFilter(1, name); //歌ってみた
                }
            }
            //ルカ
            if (wiki_id === "renshu_suruka") {
                if (title.match(/^(?!ルカ)(.+?)\s*【歌唱楽曲一覧】/)) {
                    const name = RegExp.$1;
                    applyFilter(0, name); //オリジナルソング
                    applyFilter(1, name); //歌ってみた
                }
            }
            //wiki別分岐終了
    
            //すべてのページ
            if (keyword) {
                const order = params.get('order') || 0;
                applyFilter(order, keyword);
            }
        }
    
        window.addEventListener("hashchange", function() {
            const params = getParams(true);
            const keyword = params.get('keyword');
            if (keyword) {
                const order = params.get('order') || 0;
                applyFilter(order, keyword);
            }
        }, false);
    
        function getParams(jump_to_anchor) {
            const url = new URL(window.location.href);
            const hash = url.hash;
            const params = url.searchParams;
    
            const sep = hash.indexOf("?");
            if (sep > -1) {
                const hashParams = new URLSearchParams(hash.substring(sep));
                hashParams.forEach((val, key) => {
                    params.set(key, val);
                });
                const aname = hash.substring(1, sep);
                if (aname && jump_to_anchor) {
                    const anchor = document.getElementById(aname) || [...document.querySelectorAll("a[name]")].find((e)=>(e.name == aname));
                    if (anchor) {
                        //anchor.scrollIntoView();
                        window.scrollTo(0, anchor.offsetTop - 40);
                    }
                }
            }
    
            return params;
        }
    
        function applyFilter(indice, keyword) {
            for (const idx of String(indice).split(",")) {
                const table = $("table.filter").eq(idx);
                const input = $(`#table-filter-${idx}`);
                if (!input) return;
                table.addClass("regex");
                input.val(keyword).change();
            }
        }
    
    } // setupSongListAutoFilter
    
    ////
    // フィルターリンク生成機能 (記事画面右メニュー)
    ////
    
    function setupTableFilterGenerator() {
    
        // HTML側から関数を呼び出せるように
        window.createFilterSearch = createFilterSearch;
    
        function createFilterSearch() {
            let url = new URL(window.location.href.split('#')[0]);
            var params = url.searchParams;
            params.delete('keyword');
            params.delete('order');
            let j = 0;
    
            let elements = document.getElementsByName('order');
            let len = elements.length;
            let checkValue = '0';
            for (let i = 0; i < len; i++){
                if (elements.item(i).checked){
                    j = elements.item(i).value;
                }
            }
    
            let qry = document.getElementById(`table-filter-${j}`);
            let link = document.getElementById('freeAreaRegExp');
            if (!qry) return;
            link.setAttribute('href', url + "?keyword=" + encodeURIComponent(qry.value) + "&order=" + j);
        }
    
    } // setupTableFilterGenerator
    
    ////
    // 編集ツール (編集画面)
    ////
    
    function setupEditingTools() {
    
        let is_area_open = !!localStorage.getItem("tools_area_open");
        const tools_area = initEditingTools();
    
        addTool("options", "設定", function() {
            const tool_content = this;
            tool_content.addClassName("tool-options");
    
            addCheckbox("syntax_check", "文法チェックを有効化", false);
            addCheckbox("syntax_check.folding", "文法チェック：折りたたみの整合性チェック", true);
            addCheckbox("syntax_check.box", "文法チェック：BOX記法の整合性チェック", true);
            addCheckbox("syntax_check.table", "文法チェック：テーブルの整合性チェック", true);
            addCheckbox("syntax_check.anchor", "文法チェック：アンカーの重複チェック", true);
    
            function addCheckbox(name, label, default_, onchanged) {
                const el_label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = !!JSON.parse(localStorage.getItem(`tool.${name}.enabled`) || default_.toString());
                el_label.appendChild(checkbox);
                const text = document.createTextNode(label);
                el_label.appendChild(text);
    
                localStorage.setItem(`tool.${name}.enabled`, checkbox.checked.toString());
                checkbox.addEventListener("change", function(e) {
                    localStorage.setItem(`tool.${name}.enabled`, this.checked.toString());
                    window.dispatchEvent(new Event("option-changed"));
                    if (onchanged) {
                        onchanged.call(this, e);
                    }
                });
    
                tool_content.appendChild(el_label);
            }
        });
    
        addSimpleProcessor("htmlref", "実体参照変換", function(text) {
            text = text.replace(/[#!%&'()*+,.:=>@[\]\^_|~-]/g, (v)=>("&#" + v.codePointAt(0) + ";"));
            return text;
        }, (
            `数値参照に変換する(wiki記法と衝突する文字処理用)
    
            ( → &#40;
            ! → &#33;
            [ → &#91;
            # → &#35; など`.replace(/^[ \t]+/gm, "")
        ));
    
        addSimpleProcessor("tweetref", "ツイート参照タグ生成", function(text) {
            text = text.split(/[\r\n]+/).map((line)=>{
                const url = parseURL(line);
                if (url && url.hostname === "twitter.com") {
                    const pathArr = url.pathname.split("/");
                    const index = pathArr.findIndex(v => v === "status");
                    return `&twitter(${pathArr[index+1]})\n`
                         + "----注釈版----\n"
                         + `((Twitter [[@${pathArr[index-1]}>>${url}]]))`;
                }
            }).filter(Boolean).join("\n\n") + "\n";
            return text;
        }, (
            `ツイートURLからwikiタグ2種に変換する
    
            https://twitter.com/tokino_sora/status/1567175591358787585
            ↓↓↓
            &twitter(1567175591358787585)
            ----注釈版----
            ((Twitter [[@tokino_sora>>https://twitter.com/tokino_sora/status/1567175591358787585]]))`.replace(/^[ \t]+/gm, "")
        ));
    
        addSimpleProcessor("videolist", "動画一覧用加工", function(text) {
            text = text.split(/[\r\n]+/).map((line)=>{
                const url = parseURL(line);
                let vid;
                if (url && url.hostname === "www.youtube.com") {
                    vid = url.searchParams.get("v");
                } else if (url && url.hostname === "youtu.be") {
                    vid = url.pathname.slice(1);
                }
                if (vid) {
                    return `[[&ref(https://i.ytimg.com/vi/${vid}/mqdefault.jpg,100%)>>https://youtu.be/${vid}]]`;
                }
            }).filter(Boolean).join("\n") + "\n";
            return text;
        }, (
            `YouTubeの動画URLをサムネ付きタグに変換する(動画一覧用加工)
    
            https://www.youtube.com/watch?v=TjGC7Jzc5ns
            https://youtu.be/TjGC7Jzc5ns
            ↓↓↓
            [[&ref(https://i.ytimg.com/vi/TjGC7Jzc5ns/mqdefault.jpg,100%)>>https://youtu.be/TjGC7Jzc5ns]]`.replace(/^[ \t]+/gm, "")
        ));
    
        const members_data = initMembersData();
        if (members_data) {
            const repr = Object.getOwnPropertyNames(members_data)[0];
            addSimpleProcessor("liveeurl", "YouTube配信URL", function(text) {
                for (const key in members_data) {
                    const reftag = `[[${members_data[key].name}>>https://www.youtube.com/channel/${members_data[key].yt}/live]]`;
                    text = text.replaceAll(members_data[key].name, reftag);
                }
                return text;
            }, (
                `メンバー名をYouTube配信へのリンクに変換する
    
                ${members_data[repr].name}
                ↓↓↓
                [[${members_data[repr].name}>>https://www.youtube.com/channel/${members_data[repr].yt}/live]]`.replace(/^[ \t]+/gm, "")
            ));
        }
    
        activateTool(localStorage.getItem("active_tool") || "htmlref");
    
        function initEditingTools() {
            const style = `
              .tools-area .toggle-button {
                border: none;
                width: 24px;
                height: 24px;
                margin-right: 10px;
                vertical-align: middle;
                cursor: pointer;
                background-image: url('https://static.seesaawiki.jp/img/usr_second/common/edit/btn_close.gif?0.7.9');
              }
              .tools-area .toggle-button:hover {
                background-image: url('https://static.seesaawiki.jp/img/usr_second/common/edit/btn_close_on.gif?0.7.9');
              }
              .tools-area .toggle-button.open {
                background-image: url('https://static.seesaawiki.jp/img/usr_second/common/edit/btn_open.gif?0.7.9');
              }
              .tools-area .toggle-button.open:hover {
                background-image: url('https://static.seesaawiki.jp/img/usr_second/common/edit/btn_open_on.gif?0.7.9');
              }
              .tools-area > label {
                font-size: 14px;
                font-weight: bold;
                vertical-align: middle;
                cursor: pointer;
              }
              .tools-area .toggle-area {
                display: none;
                margin-top: 5px;
                min-height: 200px;
              }
              .tools-area .toggle-area.open {
                display: flex;
              }
              .tools-area ul.tool-menu {
                width: 150px;
                margin-top: 0;
                margin-bottom: 0;
                margin-right: 5px;
                padding: 0;
              }
              .tools-area ul.tool-menu > li {
                list-style-type: none;
                padding: 3px;
                margin-bottom: 3px;
                font-weight: bold;
                cursor: pointer;
                text-align: center;
                border: 1px solid gray;
              }
              .tools-area ul.tool-menu > li.active {
                border: 1px solid green;
                background-color: #efe;
              }
              .tools-area .tool-box {
                flex: auto;
                border: 1px solid lightgray;
              }
              .tools-area .tool-box > .tool-content {
                height: 100%;
                display: none;
              }
              .tools-area .tool-box > .tool-content.show {
                display: block;
              }
              .tools-area .tool-content textarea {
                box-sizing: border-box;
                margin: 0;
                width: 100%;
                font-size: 13px;
              }
              .tools-area .tool-options > label {
                display: block;
                margin: 3px;
              }
            `;
            const el_style = document.createElement("style");
            el_style.appendChild(document.createTextNode(style));
            document.head.appendChild(el_style);
    
            const tools_area = document.createElement("div");
            tools_area.addClassName("tools-area");
            tools_area.addClassName("edit-line-3");
            tools_area.addClassName("clearfix");
    
            const toggle_button = document.createElement("button");
            toggle_button.id = "tool-area-toggle-button";
            toggle_button.addClassName("toggle-button");
            tools_area.appendChild(toggle_button);
    
            const label = document.createElement("label");
            label.htmlFor = "tool-area-toggle-button";
            label.innerText = "編集用ツール";
            tools_area.appendChild(label);
    
            const toggle_area = document.createElement("div");
            toggle_area.addClassName("toggle-area");
            tools_area.appendChild(toggle_area);
    
            toggle_button.classList.toggle("open", is_area_open);
            toggle_area.classList.toggle("open", is_area_open);
    
            toggle_button.addEventListener("click", function(e) {
                is_area_open = !is_area_open;
                this.classList.toggle("open", is_area_open);
                toggle_area.classList.toggle("open", is_area_open);
                if (is_area_open) {
                    localStorage.setItem("tools_area_open", "true");
                } else {
                    localStorage.removeItem("tools_area_open");
                }
                e.preventDefault();
            }, false);
    
            const tool_menu = document.createElement("ul");
            tool_menu.addClassName("tool-menu");
            toggle_area.appendChild(tool_menu);
    
            const tool_box = document.createElement("div");
            tool_box.addClassName("tool-box");
            toggle_area.appendChild(tool_box);
    
            const preview_area = document.querySelector("div#preview-container");
            preview_area.parentNode.insertBefore(tools_area, preview_area.nextSibling);
    
            return tools_area;
        }
    
        function addTool(name, label, setup) {
            const tool_menu = tools_area.querySelector("ul.tool-menu");
            const tool_box = tools_area.querySelector(".tool-box");
    
            const menu_item = document.createElement("li");
            menu_item.dataset.toolName = name;
            menu_item.innerText = label;
            tool_menu.appendChild(menu_item);
    
            menu_item.addEventListener("click", function(e) {
                activateTool(name);
            }, false);
    
            const tool_content = document.createElement("div");
            tool_content.addClassName("tool-content");
            tool_content.dataset.toolName = name;
            tool_box.appendChild(tool_content);
    
            setup.call(tool_content);
        }
    
        function addSimpleProcessor(name, label, process, placeholder) {
            addTool(name, label, function() {
                const wrapper = document.createElement("div");
                wrapper.style.display = "flex";
                wrapper.style.flexDirection = "column";
                wrapper.style.height = "100%";
                wrapper.style.alignItems = "start";
    
                const process_btn = document.createElement("button");
                process_btn.style.width = "80px";
                process_btn.innerText = "処理";
                wrapper.appendChild(process_btn);
    
                const textbox = document.createElement("textarea");
                textbox.style.flex = "auto";
                if (placeholder) {
                    textbox.placeholder = placeholder;
                }
                wrapper.appendChild(textbox);
    
                process_btn.addEventListener("click", function(e) {
                    e.preventDefault();
                    textbox.value = process(textbox.value);
                });
    
                this.appendChild(wrapper);
            });
        }
    
        function activateTool(name) {
            const tool_menu = tools_area.querySelector("ul.tool-menu");
            const tool_box = tools_area.querySelector(".tool-box");
    
            for (const menu_item of tool_menu.childNodes) {
                if (menu_item.dataset.toolName === name) {
                    menu_item.addClassName("active");
                } else {
                    menu_item.removeClassName("active");
                }
            }
    
            for (const tool_content of tool_box.childNodes) {
                if (tool_content.dataset.toolName === name) {
                    tool_content.addClassName("show");
                } else {
                    tool_content.removeClassName("show");
                }
            }
    
            localStorage.setItem("active_tool", name);
        }
    
        function parseURL(url) {
            try {
                return new URL(url);
            } catch (e) {
                return null;
            }
        }
    
    } // setupEditingTools
    
    ////
    // 文法チェッカー (編集画面)
    ////
    
    function setupSyntaxChecker() {
    
        const edit_box = document.querySelector("textarea#content");
        const info = document.createElement("ul");
        const options = {};
    
        initSyntaxChecker();
    
        window.addEventListener("option-changed", reloadSettings);
    
        function initSyntaxChecker() {
            const style = `
              ul#syntax-info {
                max-height: 120px;
                overflow-y: scroll;
                background-color: white;
                border: #b2b2b2 solid 1px;
                border-top: none;
                padding: 5px;
                margin: 0;
                list-style-position: inside;
              }
              ul#syntax-info > li {
                background-color: #eee;
                padding: 2px;
                margin: 0;
                margin-bottom: 4px;
              }
              ul#syntax-info > li.level-info {
                background-color: #eef;
              }
              ul#syntax-info > li.level-warning {
                background-color: #ffc;
              }
              ul#syntax-info > li.level-error {
                background-color: #fdd;
              }
            `;
            const el_style = document.createElement("style");
            el_style.appendChild(document.createTextNode(style));
            document.head.appendChild(el_style);
    
            const wiki_form = document.querySelector("form#wiki-form");
            const edit_inner = edit_box.parentElement;
            const edit_outer = edit_inner.parentElement;
    
            info.id = "syntax-info";
            edit_outer.appendChild(info);
    
            setupObserver(checkSyntaxAndDisplay);
            reloadSettings();
            checkSyntaxAndDisplay();
    
            wiki_form.addEventListener("submit", function(e) {
                if (!options.enabled) return;
                const has_error = Array.prototype.findIndex.call(info.childNodes, (e)=>e.hasClassName("level-error")) >= 0;
                if (has_error) {
                    const r = confirm("文法エラーがあります。そのまま保存しますか？");
                    if (!r) {
                        e.preventDefault();
                        return false;
                    }
                }
            }, false);
        }
    
        function setupObserver(trigger) {
            const delay_trigger = (function() {
                let handle = null;
                return function(delay) {
                    if (handle) {
                        clearTimeout(handle);
                        handle = null;
                    }
                    handle = setTimeout(function() {
                        handle = null;
                        trigger();
                    }, delay);
                };
            })();
            edit_box.addEventListener("change", function() {
                delay_trigger(100);
            });
            edit_box.addEventListener("keyup", function() {
                delay_trigger(500);
            });
        }
    
        function reloadSettings() {
            let changed = false;
            function load(name, item_name, default_) {
                const val = !!JSON.parse(localStorage.getItem(item_name) || String(default_));
                if (val !== options[name]) {
                    changed = true;
                }
                options[name] = val;
            }
            load("enabled", "tool.syntax_check.enabled", false);
            load("box", "tool.syntax_check.box.enabled", true);
            load("table", "tool.syntax_check.table.enabled", true);
            load("folding", "tool.syntax_check.folding.enabled", true);
            load("anchor", "tool.syntax_check.anchor.enabled", true);
            if (changed) {
                checkSyntaxAndDisplay();
            }
        }
    
        function checkSyntaxAndDisplay() {
            clearLines();
            if (!options.enabled) return;
    
            const errors = [];
            checkSyntax(edit_box.value, (msg, line, level)=>errors.push([msg, line, level]));
            errors.sort((a, b)=>a[1].start-b[1].start);
            for (const [msg, line, level] of errors) {
                addLine(msg, line, level);
            }
        }
    
        function checkSyntax(wiki, cb) {
            const state = {};
    
            const lines = wiki.split(/\n/).map((x,i)=>({
                text: x,
                lineno: i+1,
                type: null,
                next: null,
                prev: null,
                parent: null,
            }));
    
            let start = 0;
            let end = -1;
            for (const line of lines) {
                const i = line.lineno-1;
                start = end + 1;
                end = start + line.text.length;
                line.start = start;
                line.end = end;
                line.next = lines[i+1] || null;
                line.prev = lines[i-1] || null;
            }
    
            state.incode = false;
            for (const line of lines) {
                const text = line.text;
                if (state.incode) {
                    if (text.startsWith("||=")) {
                        line.type = "box-end";
                        state.incode = false;
                    } else {
                        line.type = "box-content";
                    }
                } else if (text.startsWith("||=")) {
                    line.type = "box-end-bad";
                } else if (text.startsWith("=|")) {
                    line.type = "box-start";
                    state.incode = true;
                } else if (text.startsWith("//")) {
                    line.type = "comment";
                    if (text.startsWith("//|")) {
                        line.table = true;
                    }
                } else if (text.startsWith("{|")) {
                    line.type = "table-start";
                    line.table = true;
                } else if (text.startsWith("|}")) {
                    line.type = "table-end";
                    line.table = true;
                } else if (text.startsWith("|")) {
                    line.type = "table-content";
                    line.table = true;
                } else if (text == "") {
                    line.type = "empty";
                } else if (text.startsWith("[+]") || text.startsWith("[-]")) {
                    line.type = "fold-start";
                } else if (text.startsWith("[END]")) {
                    line.type = "fold-end";
                } else if (text.startsWith("#include")) {
                    line.type = "include";
                } else if (text.startsWith("*")) {
                    line.type = "heading";
                }
                if (!state.incode && !text.startsWith("//")) {
                    line.anchors = text.match(/(?<=&aname\()[^\)]*(?=\))/g);
                }
            }
    
            // BOX記法
            if (options.box) {
                for (let line = lines[0]; line; line = line.next) {
                    if (line.type == "box-end-bad") {
                        cb("対応するBOX開始タグがありません。", line, "error");
                    }
                }
                const lastline = lines[lines.length-1];
                if (lastline.type == "box-start" || lastline.type == "box-content") {
                    let line = lastline;
                    while (line.type != "box-start") {
                        line = line.prev;
                    }
                    cb("対応するBOX終了タグがありません。", line, "error");
                }
            }
    
            // 折りたたみ記法
            if (options.folding) {
                state.fold_level = 0;
                state.folds = [];
                for (let line = lines[0]; line; line = line.next) {
                    if (line.type == "fold-start") {
                        state.fold_level++;
                        state.folds.push(line);
                    } else if (line.type == "fold-end") {
                        if (state.fold_level > 0) {
                            state.fold_level--;
                            state.folds.pop();
                        } else {
                            cb("対応する折りたたみ開始タグがありません。", line, "error");
                        }
                    }
                }
                for (const line of state.folds) {
                    cb("対応する折りたたみ終了タグがありません。", line, "error");
                }
            }
    
            // テーブル
            if (options.table) {
                state.intable = false;
                state.table_has_start = false;
                state.table_end = false;
                for (let line = lines[0]; line; line = line.next) {
                    if (state.intable) {
                        if (line.type == "table-start") {
                            state.table_has_start = true;
                            if (line.prev.type == "table-start") {
                                cb("無効なテーブル開始タグです。指定は無視されます。", line, "warning");
                            } else {
                                cb("空行がありません。指定は無視され、テーブルは連結されます。", line, "error");
                            }
                        } else if (line.type == "table-content") {
                            if (state.table_end) {
                                cb("空行がありません。テーブルは連結されます。", line, "error");
                            } else {
                                // valid
                            }
                        } else if (line.type == "comment" && line.text.startsWith("//|")) {
                            line.table_error = true;
                            if (!line.prev.table_error) {
                                let splitted = false;
                                for (let next = line.next; next; next = next.next) {
                                    if (next.type == "comment") continue;
                                    if (next.type == "table-content") {
                                        splitted = true;
                                    }
                                    break;
                                }
                                if (splitted) {
                                    cb("テーブル行がコメントアウトされています。テーブルは分断されます。", line, "error");
                                } else {
                                    cb("テーブル行がコメントアウトされています。", line, "warning");
                                }
                            }
                        } else if (line.type == "table-end") {
                            if (state.table_has_start) {
                                if (state.table_end) {
                                    cb("無効なテーブル終了タグです。", line, "warning");
                                } else {
                                    state.table_end = true;
                                }
                            } else {
                                cb("無効なテーブル終了タグです。", line, "warning");
                            }
                        } else {
                            if (state.table_has_start && !state.table_end) {
                                state.intable = false;
                                cb("テーブル終了タグがありません。", line.prev, "warning");
                            } else {
                                state.intable = false;
                            }
                        }
                    } else {
                        if (line.type == "table-start") {
                            state.intable = true;
                            state.table_has_start = true;
                            state.table_end = false;
                        } else if (line.type == "table-content") {
                            state.intable = true;
                            state.table_has_start = false;
                            state.table_end = false;
                        } else if (line.type == "table-end") {
                            cb("無効なテーブル終了タグです。", line, "warning");
                        } else {
                            // valid
                        }
                    }
                    if (!line.next && state.intable && state.table_has_start && !state.table_end) {
                        cb("テーブル終了タグがありません。", line, "warning");
                    }
                }
            }
    
            // アンカー
            if (options.anchor) {
                const all_anchors = {};
                for (let line = lines[0]; line; line = line.next) {
                    if (line.anchors) {
                        for (const name of line.anchors) {
                            if (name in all_anchors) {
                                cb("アンカー名が重複しています。ページ内リンクとして使用する場合は対処が必要です。", line, "warning");
                            }
                            all_anchors[name] = true;
                        }
                        if (line.type == "heading") {
                            cb("見出しにアンカーが使用されています。", line, "warning");
                        }
                    }
                }
            }
        }
    
        function clearLines() {
            while (info.firstChild) {
                info.removeChild(info.firstChild);
            }
        }
    
        function addLine(message, line, level) {
            const lineno = line.lineno;
            const start = line.start;
            const end = line.end;
            const item = document.createElement("li");
            item.addClassName(`level-${level}`);
            const link = document.createElement("a");
            link.innerText = "L."+lineno;
            link.style.marginRight = "10px";
            link.href = "#L"+lineno;
            link.addEventListener("click", function(e) {
                e.preventDefault();
                edit_box.scroll(0, calculateScrollHeight(start));
                edit_box.setSelectionRange(start, end);
                edit_box.focus();
            }, false);
            const text = document.createElement("span");
            text.innerText = message;
            item.appendChild(link);
            item.appendChild(text);
            info.appendChild(item);
        }
    
        function calculateScrollHeight(start) {
            const clone = edit_box.cloneNode();
            clone.id = "";
            clone.style.visibility = "hidden";
            clone.style.zIndex = "-1";
            clone.style.position = "absolute";
            clone.style.height = "1px";
            clone.value = clone.value.substring(0, start);
            edit_box.parentNode.appendChild(clone);
            const y = Math.max(0, clone.scrollHeight - edit_box.clientHeight/2);
            clone.remove();
            return y;
        }
    
    } // setupSyntaxChecker
    
    function initMembersData() {
        if (wiki_id === "hololivetv") {
            return {
                sora:		{yt: "UCp6993wxpyDPHUpavwDFqgg", bi: "8899503", tw: "", name: "ときのそら", tag: "#ときのそら生放送"},
                roboco:		{yt: "UCDqI2jOz0weumE8s7paEk6g", bi: "4664126", tw: "", name: "ロボ子さん", tag: "#ロボ子生放送"},
                mel:		{yt: "UCD8HOxPs4Xvsm8H0ZxXGiBw", bi: "21131813", tw: "", name: "夜空メル", tag: "#メル生放送"},
                rose:		{yt: "UCFTLzh12_nrtzqBPsTCqenA", bi: "21219990", tw: "", name: "アキロゼ", tag: "#アキびゅーわーるど"},
                haato:		{yt: "UC1CfXB_kRs3C-zaeTG3oGyg", bi: "14275133", tw: "", name: "赤井はあと", tag: "#はあちゃまなう"},
                fubuki:		{yt: "UCdn5BQ06XqgXoAxIhbqw5Rg", bi: "11588230", tw: "", name: "白上フブキ", tag: "#フブキch"},
                matsuri:	{yt: "UCQ0UDLQCjY0rmuxCDE38FGg", bi: "13946381", tw: "", name: "夏色まつり", tag: "#夏まつch"},
                aqua:		{yt: "UC1opHUrw8rvnsadT-iGp7Cg", bi: "14917277", tw: "", name: "湊あくあ", tag: "#湊あくあ生放送"},
                shion:		{yt: "UCXTpFs_3PqI41qX2d9tL2Rw", bi: "21132965", tw: "", name: "紫咲シオン", tag: "#紫咲シオン"},
                nakiri:		{yt: "UC7fk0CB07ly8oSl0aqKkqFg", bi: "21130785", tw: "", name: "百鬼あやめ", tag: "#百鬼あやめch"},
                choco:		{yt: "UC1suqwovbL1kzsoaZgFZLKg", bi: "21107534", tw: "", name: "癒月ちょこ", tag: "#癒月診療所"},
                subaru:		{yt: "UCvzGlP9oQwU--Y0r9id_jnA", bi: "21129632", tw: "", name: "大空スバル", tag: "#生スバル"},
                mio:		{yt: "UCp-5t9SrOQwXMU7iIjQfARg", bi: "21133979", tw: "", name: "大神ミオ", tag: "#ミオかわいい"},
                miko:		{yt: "UC-hM6YJuNYVAmUWxeIr9FeA", bi: "21144047", tw: "", name: "さくらみこ", tag: "#みこなま"},
                korone:		{yt: "UChAnqc_AY5_I3Px5dig3X1Q", bi: "21421141", tw: "", name: "戌神ころね", tag: "#生神もんざえもん"},
                okayu:		{yt: "UCvaTdHTWBGv3MKj3KVqJVCw", bi: "21420932", tw: "", name: "猫又おかゆ", tag: "#生おかゆ"},
                azki:		{yt: "UC0TXe_LYZ4scaW2XMyi5_kw", bi: "21267062", tw: "", name: "AZKi", tag: "#AZKi生放送・#あずきんち"},
                suisei:		{yt: "UC5CwaMl1eIgY8h02uZw7u8A", bi: "190577", tw: "", name: "星街すいせい", tag: "#ほしまちすたじお"},
                pekora:		{yt: "UC1DCedRgGHBdm81E1llLhOQ", bi: "21560356", tw: "", name: "兎田ぺこら", tag: "#ぺこらいぶ"},
                rushia:		{yt: "UCl_gCybOJRIgOXw6Qb4qJzQ", bi: "21545232", tw: "", name: "潤羽るしあ", tag: "#るしあらいぶ"},
                flare:		{yt: "UCvInZx9h3jC2JzsIzoOebWg", bi: "21572617", tw: "", name: "不知火フレア", tag: "#フレアストリーム"},
                noel:		{yt: "UCdyqAaZDKHXg4Ahi7VENThQ", bi: "21583736", tw: "", name: "白銀ノエル", tag: "#ノエルーム"},
                marine:		{yt: "UCCzUftO8KOVkV4wQG1vkUvg", bi: "21584153", tw: "", name: "宝鐘マリン", tag: "#マリン航海記"},
                kanata:		{yt: "UCZlDXzGoo7d44bwdNObFacg", bi: "21752681", tw: "", name: "天音かなた", tag: "#天界学園放送部"},
                coco:		{yt: "UCS9uQI-jC3DE0L4IpXyvr6w", bi: "21752686", tw: "", name: "桐生ココ", tag: "#ココここ"},
                watame:		{yt: "UCqm3BQLlJfvkTsX_hvm0UmA", bi: "21752694", tw: "", name: "角巻わため", tag: "#ドドドライブ"},
                towa:		{yt: "UC1uv2Oq6kNxgATlCiez59hw", bi: "21752710", tw: "", name: "常闇トワ", tag: "#トワイライヴ"},
                luna:		{yt: "UCa9Y57gfeY0Zro_noHRVrnw", bi: "21752719", tw: "", name: "姫森ルーナ", tag: "#なのらいぶ"},
                lamy:		{yt: "UCFKOVgVbGmX65RxO3EtH3iw", bi: "", tw: "", name: "雪花ラミィ", tag: "#らみらいぶ"},
                nene:		{yt: "UCAWSyEs_Io8MtpY3m-zqILA", bi: "", tw: "", name: "桃鈴ねね", tag: "#ねねいろらいぶ"},
                botan:		{yt: "UCUKD-uaobj9jiqB-VXt71mA", bi: "", tw: "", name: "獅白ぼたん", tag: "#ぐうたらいぶ"},
                aloe:		{yt: "UCgZuwn-O7Szh9cAgHqJ6vjw", bi: "", tw: "", name: "魔乃アロエ", tag: "#魔のらいぶ"},
                polka:		{yt: "UCK9V2B22uJYu3N7eR_BT9QA", bi: "", tw: "", name: "尾丸ポルカ", tag: "#ポルカ公演中"},
                Laplus:		{yt: "UCENwRMx5Yh42zWpzURebzTw", bi:"", tw: "", name: "ラプラス・ダークネス", tag: ""},
                Lui:		{yt: "UCs9_O1tRPMQTHQ-N_L6FU2g", bi:"", tw: "", name: "鷹嶺ルイ", tag: ""},
                Koyori:		{yt: "UC6eWCld0KwmyHFbAqK3V-Rw", bi:"", tw: "", name: "博衣こより", tag: ""},
                Chloe:		{yt: "UCIBY1ollUsauvVi4hW4cumw", bi:"", tw: "", name: "沙花叉クロヱ", tag: ""},
                Iroha:		{yt: "UC_vMYWcDjmfdpH6r4TTn1MQ", bi:"", tw: "", name: "風真いろは", tag: ""},
    
                risu:		{yt: "UCOyYb1c43VlX9rc_lT6NKQw", bi:"", tw:"", name: "Ayunda Risu", tag: ""},
                moona:		{yt: "UCP0BspO_AMEe3aQqqpo89Dg", bi:"", tw:"", name: "Moona Hoshinova", tag: ""},
                iofi:		{yt: "UCAoy6rzhSf4ydcYjJw3WoVg", bi:"", tw:"", name: "Airani Iofifteen", tag: ""},
                ollie:		{yt: "UCYz_5n-uDuChHtLo7My1HnQ", bi:"", tw:"", name: "Kureiji Ollie", tag: ""},
                anya:		{yt: "UC727SQYUvx5pDDGQpTICNWg", bi:"", tw:"", name: "Anya Melfissa", tag: ""},
                reine:		{yt: "UChgTyjG-pdNvxxhdsXfHQ5Q", bi:"", tw:"", name: "Pavolia Reine", tag: ""},
                zeta:		{yt: "UCTvHWSfBZgtxE4sILOaurIQ", bi:"", tw:"", name: "Vestia Zeta", tag: ""},
                kaela:		{yt: "UCZLZ8Jjx_RN2CXloOmgTHVg", bi:"", tw:"", name: "Kaela Kovalskia", tag: ""},
                kobo:		{yt: "UCjLEmnpCNeisMxy134KPwWw", bi:"", tw:"", name: "Kobo Kanaeru", tag: ""},
                indonesia:	{yt: "UCfrWoRGlawPQDQxxeIDRP0Q", bi:"", tw:"", name: "hololive Indonesia",tag: ""},
    
                calliope:	{yt: "UCL_qhgtOy0dy1Agp8vkySQg", bi:"", tw:"", name: "Mori Calliope", tag: ""},
                kiara:		{yt: "UCHsx4Hqa-1ORjQTh9TYDhww", bi:"", tw:"", name: "Takanashi Kiara", tag: ""},
                inanis:		{yt: "UCMwGHR0BTZuLsmjY_NT5Pwg", bi:"", tw:"", name: "Ninomae Ina'nis", tag: ""},
                gura:		{yt: "UCoSrY_IQQVpmIRZ9Xf-y93g", bi:"", tw:"", name: "Gawr Gura", tag: ""},
                amelia:		{yt: "UCyl1z3jo3XHR1riLFKG5UAg", bi:"", tw:"", name: "Watson Amelia", tag: ""},
                irys:		{yt: "UC8rcEBzJSleTkf_-agPM20g", bi:"", tw:"", name: "IRyS", tag: ""},
                sana:		{yt: "UCsUj0dszADCGbF3gNrQEuSQ", bi:"", tw:"", name: "Tsukumo Sana", tag: ""},
                fauna:		{yt: "UCO_aKKYxn4tvrqPjcTzZ6EQ", bi:"", tw:"", name: "Ceres Fauna", tag: ""},
                kronii:		{yt: "UCmbs8T6MWqUHP1tIQvSgKrg", bi:"", tw:"", name: "Ouro Kronii", tag: ""},
                mumei:		{yt: "UC3n5uGu18FoCy23ggWWp8tA", bi:"", tw:"", name: "Nanashi Mumei", tag: ""},
                hakos:		{yt: "UCgmPnx-EEeOrZSg5Tiw7ZRQ", bi:"", tw:"", name: "Hakos Baelz", tag: ""},
                english:	{yt: "UCotXwY6s8pWmuWd_snKYjhg", bi:"", tw:"", name: "hololive English", tag: ""},
    
                ankimo:		{yt: "UCGSOfFtVCTBfmGxHK5OD8ag", bi: "", tw: "", name: "あん肝", tag: "#あん肝"},
    
                chocosub:	{yt: "UCp3tgHXw_HI0QMk1K8qh3gQ", bi: "", tw: "", name: "ちょこSub", tag: "#癒月診療所"},
                //	gamer:		{name: "ホロライブゲーマーズ"},
                holo:		{yt: "UCJFZiqLMntJufDCHc6bQixg", bi: "8982686", tw: "", name: "ホロライブ公式", tag: "#ホロライブ"}
            };
        } else if (wiki_id === "siroyoutuber") {
            return {
                chieri:     { yt: "UCP9ZgeIJ3Ri9En69R0kJc9Q", tw: "chieri_kakyoin", ml: "10596504", name: "花京院ちえり", tag: "#花京院ちえり" },
                dot:        { yt: "UCAZ_LA7f0sjuZ1Ni8L2uITw", tw: "dotLIVEyoutuber", name: ".LIVE", tag: "#どっとライブ" },
                iori:       { yt: "UCyb-cllCkMREr9de-hoiDrg", tw: "YamatoIori", ml: "10596535", name: "ヤマトイオリ", tag: "#ヤマトイオリ" },
                mememe:     { yt: "UCz6Gi81kE6p5cdW1rT0ixqw", tw: "mokomeme_ch", ml: "10596609", name: "もこ田めめめ", tag: "#もこ田めめめ" },
                milk:       { yt: "UCju7v8SkoWUQ5ITCQwmYpYg", tw: "milk_merry_", name: "メリーミルク", tag: "#ひつじさんといっしょ" },
                pino:       { yt: "UCMzxQ58QL4NNbWghGymtHvw", tw: "carro_pino", ml: "10953955", name: "カルロピノ", tag: "#カルロピノ" },
                siro:       { yt: "UCLhUvJ_wO9hOvv_yYENu4fQ", tw: "SIROyoutuber", bl: "21307497", name: "電脳少女シロ", tag: "#シロ生放送" },
                suzu:       { yt: "UCUZ5AlC3rTlM-rA2cj5RP6w", tw: "kagura_suzu", ml: "10596385", name: "神楽すず", tag: "#神楽すず" },
                uma:        { yt: "UC6TyfKcsrPwBsBnx2QobVLQ", tw: "bayoutuber", name: "ばあちゃる", tag: "#ばあちゃる" },
                milily:     { yt: "UCSlcMof1GIPvH6H_VcknCbQ", tw: "Milily_VTuber", name: "七星みりり", tag: "#ななみりライブ" },
                rikumu:     { yt: "UCtM5G3bS7zM8bv6p-OwoNTw", tw: "Rikumu_VTuber", name: "リクム", tag: "#リクム" },
                rururica:   { yt: "UCcd4MSYH7bPIBEUqmBgSZQw", tw: "Rururica_VTuber", name: "ルルンルルリカ", tag: "#ルルンルーム" },
                radio:      { yt: "UCMzxQ58QL4NNbWghGymtHvw", tw: "carro_pino", name: "カルロピノ", tag: "#とりとらじお" },
            };
        }  else if (wiki_id === "renshu_suruka") {
            return {
                ruka:     {yt: "UCIBY1ollUsauvVi4hW4cumw", bi:"", tw: "", name: "ルカ", tag: ""},
                nakama:     {yt: "UCIBY1ollUsauvVi4hW4cumw", bi:"", tw: "", name: "仲間", tag: ""},
                Chloe:		{yt: "UCIBY1ollUsauvVi4hW4cumw", bi:"", tw: "", name: "沙花叉クロヱ", tag: "#またまたさかまた"},
            };
        }
        return null;
    }
    
    })();
