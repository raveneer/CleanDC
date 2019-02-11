import { Observer, Message, Element } from '../../utils'
import _ from 'lodash'
import querystring from 'querystring'
const { classes: cls, selectors: sel, tag } = Element

class Block {
  constructor ({ check, blacklist }) {
    const { user, word, regex, jjal } = blacklist
    this.cache = {
      user: _.zipObject(user, user),
      word: _.zipObject(word, word),
      regex: regex.map(x => new RegExp(x)),
      jjal: _.zipObject(jjal, jjal),
    }
    Object.assign(this, // 체크 활성화가 되어있지 않은건 빈함수로 오버라이드
      _(['user', 'word', 'regex', 'jjal'])
        .filter(x => !check[x])
        .map(x => [x, () => {}])
        .fromPairs().value()
    )
  }

  static create (options) {
    if (this._block) return this._block
    this._block = options.then(x => new this(x))
    return this._block
  }

  list (table) {
    _(table.find(sel.row)).map($).forEach(x => this.user(x) || this.word(x) || this.regex(x))
  }

  article (article) {
    const onMatch = msg => {
      alert(msg)
      window.history.back()
    }
    this.jjal(article)
    if (this.user(article)) return onMatch('차단된 작성자의 게시물입니다.')
    if (this.word(article)) return onMatch('차단된 키워드가 있는 글입니다.')
    if (this.regex(article)) return onMatch('정규식 차단된 작성자의 게시물입니다.')
    return true
  }
  commentsObserve (wrap) {
    Observer.watch(wrap, () => this.comments(wrap))
  }
  comments (wrap) {
    _(wrap.find(sel.row)).map($).forEach(x => this.user(x) || this.word(x) || this.regex(x))
  }

  user (item) {
    const writer = item.find(sel.writer)
    if (!writer.length) return
    const { uid, ip, nick } = writer.data()
    const match = _.find([uid, ip, nick], x => this.cache.user[x])
    if (match) item.addClass(cls.block)
    return match
  }
  word (item) {
    const text = item.text()
    const match = _.find(this.cache.word, x => text.includes(x))
    if (match) item.addClass(cls.block)
    return match
  }
  regex (item) {
    const writer = item.find(sel.writer)
    if (!writer.length) return
    const { nick } = writer.data()
    const match = _.find(this.cache.regex, x => x.test(nick))
    if (match) item.addClass(cls.block)
    return match && nick
  }
  jjal (attachment) {
    _(attachment.find('li a')).map($)
      .map(a => ({
        name: a.text(),
        params: querystring.parse(_(a.attr('href')).split('?').get(1)) // 쿼리스트링 파싱
      }))
      .filter(({ name }) => this.cache.jjal[name])
      .forEach(({ params }) => $(`img[src*=${params.no}],img[onclick*=${params.no}]`).addClass(cls.block))
  }
}

export async function set (options) {
  const body = await Observer.wait(document.documentElement, 'body')
  const block = new Block(options)
  Observer.wait(body, sel.list).then(x => block.list(x), () => {})
  Observer.wait(body, sel.article).then(article => {
    block.article(article) &&
    Observer.wait(article.parent(), sel.comments)
      .then(x => block.commentsObserve(x), () => {})
  }, () => {})
}
export function update (options) {
  const block = new Block(options)
  const article = $(sel.article)
  const table = $(sel.list)
  $(sel.block).removeClass(cls.block)
  if (table.length) block.list(table)
  if (article.length) {
    block.article(article)
    article.find(sel.attachment).each((i, el) => block.jjal($(el)))
    article.parent().find(sel.comments).each((i, el) => block.comments($(el)))
  }
}

export function list (list, options) {
  $(sel.writer).find(sel.contextMenuTarget).wrapInner(tag.contextMenu) // context 메뉴 지원 래퍼 추가
  Block.create(options).then(block => block.list(list, options))
}

export function article (article, options) {
  Block.create(options).then(block => block.article(article, options))
}

export function attachment (attachment, options) {
  Block.create(options).then(block => block.jjal(attachment, options))
}
export function comments (comments, options) {
  Block.create(options).then(block => block.comments(comments, options))
  comments.find(sel.writer).find(sel.contextMenuTarget).wrapInner(tag.contextMenu) // context 메뉴 지원 래퍼 추가
}

export function ready () {
  // 우클릭 한 유저 정보 기억
  let rightClickId
  document.addEventListener('mousedown', event => {
    if (event.button !== 2) return
    const writer = $(event.target).closest(sel.row).find(sel.writer)
    if (!writer.length) return
    const { uid, ip, nick } = writer.data()
    rightClickId = uid || ip || nick
  }, true)
  Message.listen('requestTargetId', (payload, sender, res) => res(rightClickId))
}

export default { update, ready, list, article, attachment, comments }
