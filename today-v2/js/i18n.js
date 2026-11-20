// 网页的中英两版（11-21 他要「getcloudia.com 进来就是英文首页，右上可以选语言」）。
// 默认英文；首屏右上角 EN / 中文 切换，选过的记在 localStorage（cloudia-lang），网址里 ?lang=zh / ?lang=en 优先。
// 做法：页面上的英文原句当键，中文版打开时把文字节点和 title / aria-label / placeholder / alt 换掉；
// 之后 app.js 动态写进去的字（提示、按钮）由 MutationObserver 接着换。带变量的句子在 app.js 里按 zh 分开写。
const KEY = 'cloudia-lang';
export const LANG = (() => {
  let l = new URLSearchParams(location.search).get('lang');
  try { if (l) localStorage.setItem(KEY, l); else l = localStorage.getItem(KEY); } catch (_) {}
  return l === 'zh' ? 'zh' : 'en';
})();
export const zh = LANG === 'zh';

const ZH = {
  // 标题
  'What do you see in this cloud? · Cloudia': '这朵云像什么？· 云想',
  'What do you see in this sky? · Cloudia': '这片天像什么？· 云想',
  'Blank page · Cloudia': '白纸 · 云想',
  'Cloudia': '云想',
  // 首屏
  'Draw on a real cloud.': '在真的云上画画。',
  'Find a shape, draw it in, then step inside your cloud in a mirror sky.': '看出一个形状，把它画出来，再走进天空之镜里的那朵云。',
  'A real cloud drifts into a mirror sky and a whale is traced on it; around it hang clouds others have painted': '一朵真云飘进天空之镜，上面描出一条鲸鱼；四周挂着别人在云上画的画',
  '360° · drag to look around': '360° · 拖动看四周',
  'Look around the sky': '看看四周的天',
  'Turn left': '向左转', 'Turn right': '向右转',
  'Draw on today’s cloud ↓': '在今天这朵云上画 ↓',
  'Language': '语言',
  // 画板
  'What do you see in this cloud?': '这朵云像什么？',
  'What do you see in this sky?': '这片天像什么？',
  'Draw anything — then put it on a real sky.': '随便画——再把它放到真的天上。',
  'Trace it with your finger.': '用手指把它描出来。',
  'Trace it with your finger — then give it some eyes.': '用手指把它描出来——再给它加上眼睛。',
  'Trace it with your mouse or trackpad. Hold space to move around, ⌘/Ctrl + scroll to zoom.': '用鼠标或触控板把它描出来。按住空格拖动画面，⌘/Ctrl + 滚轮缩放。',
  'Start on paper. When you’re done, your drawing can move onto a cloud.': '先在纸上画。画好了，可以把画挪到一朵云上。',
  'Clouds': '云', 'Old skies': '老画里的天', 'Blank page': '白纸',
  'Close': '关闭',
  'Draw right on the picture': '直接在图上画',
  '⤢ Bigger': '⤢ 放大', 'Draw full screen': '全屏画',
  'Zoom back out': '缩回原样',
  'Paper': '纸', 'Page shape': '画幅',
  'Draw': '画笔', 'Shapes': '形状', 'Stickers': '贴纸', 'Text': '文字',
  'Fun brushes': '趣味笔',
  'Filled boxes and circles': '方框和圆涂满颜色',
  'Drag on the picture. Hold Shift for straight lines, squares and circles.': '在图上拖动。按住 Shift 画直线、正方形和正圆。',
  'Say something…': '写点什么…', 'Text to add': '要加的文字', 'Add': '加上', 'Font': '字体',
  'Remove': '移除', 'Front': '最前', 'Back': '最后', 'Copy': '复制', 'Flip': '翻转', 'Delete': '删除',
  'Bring to front': '移到最前面', 'Send to back': '移到最后面', 'Duplicate': '复制一个',
  'Tap one to pick it up. Drag to move · pinch or use the blue corner to size and turn.': '点一下选中。拖动来挪 · 双指捏合或拖蓝色的角来缩放、旋转。',
  'Any color': '任意颜色',
  'Pick a color from the picture': '从图上取色', 'Pick a color from the picture (I)': '从图上取色（I）',
  'Size': '粗细', 'Line size': '线的粗细', 'Opacity': '透明度', 'Mirror': '对称', 'Mirror drawing': '对称着画',
  'Photo': '照片', 'Fade the photo while you trace': '描的时候把照片调淡',
  'This page doesn’t keep your drawing — tap': '这个网页不保存你的画——点',
  'Save': '「保存」',
  'for a copy, or keep them all in': '存一份，或者都留在',
  'the Cloudia app': '云想 app',
  '(free on iPhone & iPad).': ' 里（iPhone 和 iPad 上免费）。',
  'Undo': '撤销', 'Redo': '重做', 'Undo (⌘Z)': '撤销（⌘Z）', 'Redo (⇧⌘Z)': '重做（⇧⌘Z）',
  'Zoom out': '缩小', 'Zoom in': '放大', 'Zoom out (−)': '缩小（−）', 'Zoom in (+)': '放大（+）',
  '⤓ Save': '⤓ 保存', 'Save the picture with your drawing to this device': '把带着你的画的图存到这台设备上',
  'Done': '画好了', 'Start over': '重新开始',
  'Start over to change the shape': '重新开始才能换画幅',
  'Picked a color from the picture': '从图上取好颜色了',
  'Close the shape first — the color would spill out.': '先把形状封上口——不然颜色会漏出去。',
  'Tap the picture to pick its color': '点一下图上的地方取颜色',
  'Hold space and drag to move · ⌘/Ctrl + scroll to zoom · Esc to close': '按住空格拖动 · ⌘/Ctrl + 滚轮缩放 · Esc 关闭',
  'Turn your phone sideways for more room · pinch to zoom': '把手机横过来地方更大 · 双指缩放',
  'Pinch with two fingers to zoom in': '双指捏合放大',
  'Fill': '填色', 'Line': '直线', 'Arrow': '箭头', 'Box': '方框', 'Circle': '圆',
  'Off': '关', 'No mirror': '不对称', 'Mirror left and right': '左右对称', 'Mirror four ways': '上下左右对称', 'Six-petal kaleidoscope': '六瓣万花筒',
  'Serif': '衬线', 'Bold': '粗体', 'Hand': '手写',
  'Warm': '米黄', 'White': '纯白', 'Dots': '点阵', 'Grid': '方格', 'Night': '夜色',
  'Wide': '横幅', 'Square': '方形', 'Tall': '竖幅',
  // 笔
  'Ink': '墨水笔', 'Pencil': '铅笔', 'Brush': '刷子', 'Marker': '马克笔', 'Highlighter': '荧光笔', 'Crayon': '蜡笔',
  'Calligraphy': '书法笔', 'Airbrush': '喷枪', 'Neon': '霓虹', 'Rainbow': '彩虹', 'Dashed': '虚线', 'Eraser': '橡皮',
  'Sparkle': '星光', 'Hearts': '爱心', 'Bubbles': '泡泡', 'Confetti': '彩纸屑', 'Paw prints': '爪印', 'Fur': '绒毛',
  'Watercolor': '水彩', 'Chalk': '粉笔',
  // 贴纸
  'Faces': '表情', 'Feelings': '心情', 'Weather': '天气', 'Wings & tails': '翅膀和尾巴', 'Little things': '小东西', 'Space': '太空', 'Fun': '好玩的',
  'Two eyes': '一双眼睛', 'Big eye': '大眼睛', 'Sleepy eyes': '困困眼', 'Wink': '眨眼', 'Smile': '微笑', 'Big grin': '咧嘴笑',
  'Oh!': '哦！', 'Tongue out': '吐舌头', 'Mustache': '小胡子', 'Top hat': '礼帽', 'Party hat': '派对帽', 'Crown': '王冠',
  'Halo': '光环', 'Bow': '蝴蝶结', 'Blush': '腮红', 'Heart': '爱心', 'Sparkles': '闪闪', 'Sun': '太阳', 'Raindrops': '雨滴',
  'Lightning': '闪电', 'Snowflake': '雪花', 'Moon': '月亮', 'Star': '星星', 'Wind': '风', 'Wings': '翅膀', 'Horns': '犄角',
  'Cat ears': '猫耳朵', 'Bunny ears': '兔耳朵', 'Curly tail': '卷尾巴', 'Legs': '小腿', 'Fin': '鱼鳍', 'Antennae': '触角',
  'Sunglasses': '墨镜', 'Speech bubble': '对话框', 'Thought bubble': '想法泡泡', 'Music note': '音符', 'Zzz': 'Zzz',
  'Exclamation': '感叹号', 'Question mark': '问号', 'Heart eyes': '爱心眼', 'Balloon': '气球', 'Gift': '礼物',
  'Ice cream': '冰淇淋', 'Cupcake': '纸杯蛋糕', 'Flower': '花', 'Mushroom': '蘑菇', 'Umbrella': '雨伞', 'Kite': '风筝',
  'Rocket': '火箭', 'UFO': '飞碟', 'Ringed planet': '带环的星球', 'Comet': '彗星', 'Alien': '外星人', 'Little stars': '小星星',
  'Tear': '眼泪', 'Sweat drops': '汗珠', 'Cross': '叉', 'Round glasses': '圆眼镜', 'Bow tie': '领结', 'X eyes': '叉叉眼',
  'Dizzy': '晕乎乎', 'Star eyes': '星星眼',
  // 起名、揭晓
  'What is it?': '这是什么？',
  'a whale, a dog, a teapot…': '鲸鱼、小狗、茶壶…',
  'That\'s it': '就是它', 'That’s it': '就是它',
  'Keep it to myself': '不说了', 'Keep drawing': '接着画',
  'Step inside your cloud': '走进你的云', 'Step inside the painting': '走进这幅画',
  'Watch your drawing come alive, then fly in. Saves as a short video you can share.': '看你的画活过来，再飞进去。会存成一段能分享的小视频。',
  'Here\'s what we saw': '我们看见的', 'Here’s what we saw': '我们看见的',
  'You kept it to yourself. Fair.': '你没说。也好。',
  'Share it as a little guessing game': '做成一个小猜谜分享出去',
  'Two pictures: first the question, then your answer.': '两张图：先出题，再揭晓你的答案。',
  'Share': '分享', 'Save pictures': '存图',
  'A shark drawn on a cloud in the Cloudia app, lit like moonlight': '在云想 app 里画在云上的一条鲨鱼，打上了月光',
  'In the app, a drawing can light up like this — this shark was drawn in Cloudia and given moonlight.': '在 app 里，画能这样亮起来——这条鲨鱼是在云想里画的，打上了月光。',
  'A new cloud comes tomorrow.': '明天换一朵新的云。',
  'Nice one.': '画得好。',
  'Tap one — your drawing comes along. Can you find it in the cloud too?': '点一张——你的画会跟过去。你也能在云里找到它吗？',
  'Now put it on a real sky': '现在把它放到真的天上',
  'Pick a cloud. Your drawing comes along — move it, size it, then share it as a guessing game.': '挑一朵云，你的画会跟过去——挪一挪、调调大小，再做成猜谜分享出去。',
  'More skies': '更多的天', 'Save image': '存图', 'Save lines only (PNG)': '只存线条（PNG）',
  'Your browser would not hold the drawing — try Save image instead.': '浏览器存不下这幅画——试试「存图」。',
  'Your drawing is on the sky — drag it into place, then tap Done.': '你的画已经在天上了——拖到合适的地方，再点「画好了」。',
  'Saved to your downloads.': '已经存到「下载」里了。',
  'Press and hold each picture to save it.': '长按每张图存下来。',
  'Your picture': '你的图',
  'A real cloud': '一朵真的云',
  // 屋子、app、页脚
  'More to see': '再看看别的',
  'Real clouds, photographed and given to the public domain.': '真的云，拍下来、放进了公有领域。',
  'Painters’ skies, 1770s–1910s, from the Met’s open collection.': '画家笔下的天，1770 到 1910 年代，来自大都会艺术博物馆的开放馆藏。',
  'Start on paper, then put your drawing on a real sky.': '先在纸上画，再把画放到真的天上。',
  'Keep drawing on the sky': '在天上接着画',
  'Any sky — a winter one, a rainbow one, or the one outside your window.': '什么天都行——冬天的、有彩虹的，或者你窗外那片。',
  '21 brushes, Apple Pencil, layers — and a little judge that tells you what it sees.': '21 种笔、Apple Pencil、图层——还有一位小评审，告诉你它看见了什么。',
  'Light your drawing like sunset or moonlight.': '给你的画打上夕阳或月光。',
  'Everything you draw, kept in your own gallery. Turn one into a holiday card.': '画过的都收在你自己的画廊里，还能做成节日贺卡。',
  'Get Cloudia — free on iPhone & iPad': '下载云想——iPhone 和 iPad 上免费',
  'Cloudia is on iPhone & iPad': '云想在 iPhone 和 iPad 上',
  'For iPhone and iPad. Not on Android yet.': '支持 iPhone 和 iPad，暂时还没有安卓版。',
  'No sign-up, no cookies. This page doesn’t keep your drawing — save the pictures to keep them.': '不用注册，没有 cookie。网页不保存你的画——想留着就存图。',
  'The paper is drawn by this page.': '纸是这个网页现画的。',
  'Privacy': '隐私', 'Support': '支持',
  // 走进云里
  'Share video': '分享视频', 'Save video': '存视频', 'Preparing video…': '正在做视频…', 'Replay': '重播', 'Get Cloudia': '下载云想',
  'Your drawing, inside the cloud': '你的画，在云里面', 'Your drawing inside the cloud, in 3D': '你的画在云里面（3D）',
  'Drag to turn · pinch to zoom': '拖动转身 · 双指缩放',
  'In the app, it lights up.': '在 app 里，它会亮起来。',
  'Inside my cloud.': '在我的云里。', 'Inside my sky.': '在我的天里。',
  'Drawn on a real cloud': '画在一朵真的云上', 'Drawn on a sky from an old painting': '画在老画里的一片天上',
  'Draw on a real cloud. Free, in your browser.': '在真的云上画画。免费，打开网页就能画。',
  'What do you see?': '你看它像什么？',
  'Here’s what I saw.': '这是我看见的。',
  'A real cloud. Guess first →': '一朵真的云。先猜猜看 →',
  'A sky from an old painting. Guess first →': '老画里的一片天。先猜猜看 →',
  'A real cloud · Cloudia': '一朵真的云 · 云想',
};

// 「我们看见的」和输入框的提示词
export const WORDS_ZH = {
  'airplane': '飞机', 'alien': '外星人', 'angel': '天使', 'ant': '蚂蚁', 'apple': '苹果', 'arrow': '箭', 'astronaut': '宇航员',
  'balloon': '气球', 'banana': '香蕉', 'bat': '蝙蝠', 'bear': '熊', 'bee': '蜜蜂', 'bicycle': '自行车', 'big fish': '大鱼',
  'bird': '鸟', 'birthday cake': '生日蛋糕', 'boat': '小船', 'book': '书', 'bridge': '桥', 'bus': '公交车', 'butterfly': '蝴蝶',
  'cactus': '仙人掌', 'camel': '骆驼', 'car': '汽车', 'castle': '城堡', 'cat': '猫', 'caterpillar': '毛毛虫', 'chicken': '鸡',
  'child': '小孩', 'clock': '钟', 'clown': '小丑', 'cow': '奶牛', 'crab': '螃蟹', 'crescent moon': '弯月亮', 'crocodile': '鳄鱼',
  'crown': '王冠', 'cup': '杯子', 'dancing person': '跳舞的人', 'deer': '鹿', 'dice': '骰子', 'dinosaur': '恐龙', 'dog': '狗',
  'dolphin': '海豚', 'dragon': '龙', 'dragonfly': '蜻蜓', 'drum': '鼓', 'duck': '鸭子', 'eagle': '老鹰', 'elephant': '大象',
  'envelope': '信封', 'eyeglasses': '眼镜', 'fairy': '小仙女', 'feather': '羽毛', 'fish': '鱼', 'flag': '旗子', 'flamingo': '火烈鸟',
  'flower': '花', 'flying saucer': '飞碟', 'footprint': '脚印', 'fox': '狐狸', 'frog': '青蛙', 'ghost': '幽灵', 'giant': '巨人',
  'gift box': '礼物盒', 'giraffe': '长颈鹿', 'goose': '鹅', 'grapes': '葡萄', 'guitar': '吉他', 'hammer': '锤子', 'hand': '手',
  'hat': '帽子', 'heart': '爱心', 'hedgehog': '刺猬', 'helicopter': '直升机', 'hippo': '河马', 'horse': '马', 'hot air balloon': '热气球',
  'house': '房子', 'human face': '人脸', 'ice cream cone': '甜筒', 'jellyfish': '水母', 'kangaroo': '袋鼠', 'key': '钥匙', 'kite': '风筝',
  'knight': '骑士', 'ladybug': '瓢虫', 'leaf': '叶子', 'light bulb': '灯泡', 'lighthouse': '灯塔', 'lightning bolt': '闪电', 'lion': '狮子',
  'lizard': '蜥蜴', 'maple leaf': '枫叶', 'mermaid': '美人鱼', 'monkey': '猴子', 'monster': '怪兽', 'motorcycle': '摩托车',
  'mountain': '山', 'mushroom': '蘑菇', 'music note': '音符', 'octopus': '章鱼', 'old man': '老爷爷', 'owl': '猫头鹰', 'padlock': '锁',
  'palm tree': '椰子树', 'panda': '熊猫', 'peacock': '孔雀', 'pencil': '铅笔', 'penguin': '企鹅', 'phoenix': '凤凰', 'piano': '钢琴',
  'pig': '猪', 'profile of a face': '侧脸', 'pterodactyl': '翼龙', 'rabbit': '兔子', 'rainbow': '彩虹', 'rhinoceros': '犀牛',
  'robot': '机器人', 'rocket': '火箭', 'rose': '玫瑰', 'running person': '跑步的人', 'sailboat': '帆船', 'scissors': '剪刀',
  'seagull': '海鸥', 'seahorse': '海马', 'shark': '鲨鱼', 'sheep': '绵羊', 'ship': '大船', 'shoe': '鞋子', 'shrimp': '虾',
  'sitting person': '坐着的人', 'snail': '蜗牛', 'snake': '蛇', 'snowflake': '雪花', 'soccer ball': '足球', 'spaceship': '宇宙飞船',
  'spider': '蜘蛛', 'squirrel': '松鼠', 'star': '星星', 'starfish': '海星', 'strawberry': '草莓', 'submarine': '潜水艇', 'sun': '太阳',
  'swan': '天鹅', 'teapot': '茶壶', 'tiger': '老虎', 'train': '火车', 'tree': '树', 'truck': '卡车', 'turtle': '乌龟',
  'tyrannosaurus': '霸王龙', 'umbrella': '雨伞', 'unicorn': '独角兽', 'violin': '小提琴', 'volcano': '火山', 'watermelon slice': '西瓜片',
  'wave': '浪花', 'whale': '鲸鱼', 'windmill': '风车', 'zebra': '斑马',
};
const ZH_WORD_BACK = Object.fromEntries(Object.entries(WORDS_ZH).map(([e, z]) => [z, e]));

/** 界面上的一句：中文版有译文就用译文 */
export const T = s => (zh && Object.prototype.hasOwnProperty.call(ZH, s) ? ZH[s] : s);
/** 「我们看见的」一个词：英文原样，中文版换成中文 */
export const W = w => (zh ? WORDS_ZH[String(w).toLowerCase()] || w : w);
/** 用户打的词换回英文去对答案（中文版里打「鲸鱼」也算对上 whale） */
export const toEn = w => ZH_WORD_BACK[w] || w;

const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
function fixText(n) {
  const raw = n.data, k = raw.trim();
  if (!k || !Object.prototype.hasOwnProperty.call(ZH, k)) return;
  if (raw !== ZH[k]) n.data = ZH[k];   // 中文不要英文那几个空格
}
function fixEl(el) {
  for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && Object.prototype.hasOwnProperty.call(ZH, v.trim())) el.setAttribute(a, ZH[v.trim()]); }
}
function walk(root) {
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.tagName)) return;
  fixEl(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeType === 1 && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeType === 3 ? fixText(n) : fixEl(n);
}

/** 语言切换钮接上；中文版把整页换掉并盯着以后写进来的字 */
export function startI18n() {
  document.documentElement.lang = zh ? 'zh-Hans' : 'en';
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === LANG));
    b.addEventListener('click', e => {
      e.preventDefault();
      if (b.dataset.lang === LANG) return;
      try { localStorage.setItem(KEY, b.dataset.lang); } catch (_) {}
      const q = new URLSearchParams(location.search); q.set('lang', b.dataset.lang);
      location.href = location.pathname + '?' + q.toString() + location.hash;
    });
  }
  if (!zh) return;
  document.title = T(document.title);
  const priv = document.getElementById('privLink'), sup = document.getElementById('supLink');
  if (priv) priv.href = '../privacy.html';
  if (sup) sup.href = '../support/zh.html';
  walk(document.body);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixEl(m.target);
      else for (const n of m.addedNodes) walk(n);
    }
    if (ZH[document.title]) document.title = ZH[document.title];
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
