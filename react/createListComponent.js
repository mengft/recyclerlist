import Taro from '@tarojs/taro'
/* eslint-disable no-sequences */
/* eslint-disable no-case-declarations */
/* eslint-disable no-void */
/* eslint-disable no-return-assign */
import { memoizeOne } from '../memoize'
import { createElement, PureComponent } from 'react'
import { cancelTimeout, requestTimeout } from '../timer'
import { getRTLOffsetType } from '../domHelpers'
const IS_SCROLLING_DEBOUNCE_INTERVAL = 150

// For trigger rerender of component use same offset, need to change the value of scrollTop
const RERENDER_OFFSET = 0.1

const defaultItemKey = (index) => index // In DEV mode, this Set helps us only log a warning once per component instance.
// This avoids spamming the console every time a render happens.

let INSTANCE_ID = 0

export function isHorizontalFunc({ direction, layout }) {
  return direction === 'horizontal' || layout === 'horizontal'
}
export function isRtlFunc({ direction }) {
  return direction === 'rtl'
}
export function getRectSize(id, success = () => { }, fail = () => { }) {
  const query = Taro.createSelectorQuery()
  query.select(id).fields({
    size: true
  }, (res) => {
    if (res) {
      success(res)
    } else {
      fail()
    }
  }).exec()
}

export default function createListComponent({
  // mengft
  getItemOffset,
  getItemLeft,
  getItemWidth,
  getEstimatedTotalSize,
  getItemSize,
  getOffsetForIndexAndAlignment,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initInstanceProps,
  shouldResetStyleCacheOnItemSizeChange,
  validateProps
}) {
  let _class, _temp

  return _temp = _class = class List extends PureComponent {
    // Always use explicit constructor for React components.
    // It produces less code after transpilation. (#26)
    // eslint-disable-next-line no-useless-constructor
    constructor(props) {
      super(props)
      this._instanceProps = initInstanceProps(this.props, this)
      this._outerRef = void 0
      this._resetIsScrollingTimeoutId = null
      this.state = {
        id: this.props.id || `virtual-list-${INSTANCE_ID++}`,
        instance: this,
        isScrolling: false,
        scrollDirection: 'forward',
        scrollOffset: typeof this.props.initialScrollOffset === 'number' ? this.props.initialScrollOffset : 0,
        lockedScrollOffset: typeof this.props.initialScrollOffset === 'number' ? this.props.initialScrollOffset : 0,
        scrollUpdateWasRequested: false,
        sizeList: []
      }

      // 可复用key队列
      this.recyclerkeys = {};

      if (this.props.unlimitedSize) {
        this.state.sizeList = new Array(this.props.itemCount).fill(-1)
      }
      this.field = {
        scrollLeft: 0,
        scrollTop: 0,
        scrollHeight: 0,
        scrollWidth: 0,
        clientHeight: 0,
        clientWidth: 0
      }
      this._callOnItemsRendered = void 0
      this._callOnItemsRendered = memoizeOne((overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex) => this.props.onItemsRendered({
        overscanStartIndex,
        overscanStopIndex,
        visibleStartIndex,
        visibleStopIndex
      }))
      this.startIndex = 0;
      this.stopIndex = 0;
      this._callOnScroll = void 0
      this._callOnScroll = memoizeOne((scrollDirection, scrollOffset, scrollUpdateWasRequested, detail) => {
        this.props.onScroll({
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
          detail,
          startIndex: this.startIndex,
          stopIndex: this.stopIndex
        });
        // console.log(this.props);
        const { onEndReached, itemData } = this.props;
        // 分页逻辑
        if (onEndReached && onEndReached.constructor === Function &&
          // 只有往前滚动我们才触发
          scrollDirection === 'forward' &&
          // 可视渲染元素为最后一个元素
          this.stopIndex === itemData.length - 1) {
          onEndReached();
        }
      })

      this._getSize = void 0

      this._getSize = (size) => {
        if (typeof size === 'number' && size >= 0) {
          return size
        }
        return this.props.itemSize || 0
      }

      this._getSizeUploadSync = void 0

      this._getSizeUploadSync = (index, isHorizontal) => {
        const ID = `#${this.state.id}-${index}`

        return new Promise((resolve) => {
          const success = ({ width, height }) => {
            const { sizeList } = this.state
            const size = isHorizontal ? width : height
            if (size !== sizeList[index]) {
              sizeList[index] = this._getSize(size)
              this.setState({
                sizeList: [...sizeList]
              }, () => {
                resolve(this._getSize(size))
              })
            }
          }
          const fail = () => {
            const [startIndex, stopIndex] = this._getRangeToRender()
            if (index >= startIndex && index <= stopIndex) {
              setTimeout(() => {
                getRectSize(ID, success, fail)
              }, 100)
            }
          }
          getRectSize(ID, success, fail)
        })
      }

      this._getSizeUpload = (index, isHorizontal) => {
        this._getSizeUploadSync(index, isHorizontal)
        const { sizeList } = this.state
        return this._getSize(sizeList[index])
      }

      this._getCountSize = void 0

      this._getCountSize = (props, count, isTotalSize) => {
        if (!props.unlimitedSize) {
          if (props.numColumns === 2 && props.itemData.length > 0 && isTotalSize) {
            const index = count - 1;
            const offset = getItemOffset(props, index, this)
            const size = getItemSize(props, index, this) // T
            const makeHeaderHeight = props.makeHeaderHeight || 0;
            return offset + size - makeHeaderHeight;
          }
          return (props.itemSize || 0) * count
        }
        const { sizeList } = this.state
        const sizes = sizeList.slice(0, count)
        return sizes.reduce((p, a) => {
          return p + this._getSize(a)
        }, 0)
      }

      this._getSizeCount = void 0

      this._getStyleValue = value => {
        return typeof value === 'number'
          ? value + 'px'
          : value == null
            ? ''
            : value
      }

      this._getItemStyle = void 0

      this._getItemStyle = index => {
        const {
          direction,
          layout
        } = this.props

        const itemStyleCache = this._getItemStyleCache(shouldResetStyleCacheOnItemSizeChange, shouldResetStyleCacheOnItemSizeChange && layout, shouldResetStyleCacheOnItemSizeChange && direction)

        let style
        // mengft
        let offset = getItemOffset(this.props, index, this)
        const left = getItemLeft(this.props, index, this)
        const width = getItemWidth(this.props, index, this)
        let size = getItemSize(this.props, index, this) // TODO Deprecate direction "horizontal"

        const isHorizontal = isHorizontalFunc(this.props)
        const isRtl = isRtlFunc(this.props)
        if (itemStyleCache.hasOwnProperty(index)) {
          style = itemStyleCache[index]
          if (isHorizontal) {
            style.width = size
            if (isRtl) {
              style.right = offset
            } else {
              style.left = offset
            }
          } else {
            style.height = size
            style.top = offset
            style.left = left
            style.width = width
          }
        } else {
          const offsetHorizontal = isHorizontal ? offset : 0
          itemStyleCache[index] = style = {
            position: 'absolute',
            left: !isRtl ? offsetHorizontal : undefined,
            right: isRtl ? offsetHorizontal : undefined,
            top: !isHorizontal ? offset : 0,
            height: !isHorizontal ? size : '100%',
            width: isHorizontal ? size : '100%'
          }
          // mengft
          if (!isHorizontal) {
            itemStyleCache[index].left = left;
            itemStyleCache[index].width = width;
          }
        }

        for (const k in style) {
          if (style.hasOwnProperty(k)) {
            style[k] = this._getStyleValue(style[k])
          }
        }

        return style
      }

      this._getItemStyleCache = void 0
      this._getItemStyleCache = memoizeOne(() => ({}))

      this._onScrollHorizontal = event => {
        const {
          clientWidth,
          scrollTop,
          scrollLeft,
          scrollHeight,
          scrollWidth
        } = event.currentTarget
        this.field.scrollHeight = scrollHeight
        this.field.scrollWidth = getEstimatedTotalSize(this.props, this)
        this.field.scrollTop = scrollTop
        this.field.scrollLeft = scrollLeft
        this.field.clientHeight = scrollHeight
        this.field.clientWidth = clientWidth
        this.setState(prevState => {
          if (prevState.scrollOffset === scrollLeft) {
            // Scroll position may have been updated by cDM/cDU,
            // In which case we don't need to trigger another render,
            // And we don't want to update state.isScrolling.
            return null
          }

          let scrollOffset = scrollLeft

          if (isRtlFunc(this.props)) {
            // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
            // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
            // It's also easier for this component if we convert offsets to the same format as they would be in for ltr.
            // So the simplest solution is to determine which browser behavior we're dealing with, and convert based on it.
            switch (getRTLOffsetType()) {
              case 'negative':
                scrollOffset = -scrollLeft
                break

              case 'positive-descending':
                scrollOffset = scrollWidth - clientWidth - scrollLeft
                break
            }
          } // Prevent Safari's elastic scrolling from causing visual shaking when scrolling past bounds.

          scrollOffset = Math.max(0, Math.min(scrollOffset, scrollWidth - clientWidth))
          this.field.scrollWidth = scrollOffset
          return {
            isScrolling: true,
            scrollDirection: prevState.scrollOffset < scrollLeft ? 'forward' : 'backward',
            scrollOffset,
            lockedScrollOffset: (prevState.lockedScrollOffset === scrollLeft) ? scrollLeft + RERENDER_OFFSET : scrollOffset,
            scrollUpdateWasRequested: false
          }
        }, this._resetIsScrollingDebounced)
      }

      this._onScrollVertical = event => {
        const {
          clientHeight,
          scrollHeight,
          scrollWidth,
          scrollTop,
          scrollLeft
        } = event.currentTarget
        this.field.scrollHeight = getEstimatedTotalSize(this.props, this)
        this.field.scrollWidth = scrollWidth
        this.field.scrollTop = scrollTop
        this.field.scrollLeft = scrollLeft
        this.field.clientHeight = clientHeight
        this.field.clientWidth = scrollWidth
        this.setState(prevState => {
          if (prevState.scrollOffset === scrollTop) {
            // Scroll position may have been updated by cDM/cDU,
            // In which case we don't need to trigger another render,
            // And we don't want to update state.isScrolling.
            return null
          } // Prevent Safari's elastic scrolling from causing visual shaking when scrolling past bounds.
          const scrollOffset = Math.max(0, Math.min(scrollTop, scrollHeight - clientHeight))
          this.field.scrollTop = scrollOffset
          return {
            // isScrolling: true,
            scrollDirection: prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
            scrollOffset,
            lockedScrollOffset: (prevState.lockedScrollOffset === scrollOffset) ? scrollOffset + RERENDER_OFFSET : scrollOffset,
            scrollUpdateWasRequested: false
          }
        }, this._resetIsScrollingDebounced)
      }

      this._outerRefSetter = ref => {
        const {
          outerRef
        } = this.props
        this._outerRef = ref

        if (typeof outerRef === 'function') {
          outerRef(ref)
        } else if (outerRef != null && typeof outerRef === 'object' && outerRef.hasOwnProperty('current')) {
          outerRef.current = ref
        }
      }

      this._resetIsScrollingDebounced = () => {
        if (this._resetIsScrollingTimeoutId !== null) {
          cancelTimeout(this._resetIsScrollingTimeoutId)
        }

        this._resetIsScrollingTimeoutId = requestTimeout(this._resetIsScrolling, IS_SCROLLING_DEBOUNCE_INTERVAL)
      }

      this._resetIsScrolling = () => {
        this._resetIsScrollingTimeoutId = null
        this.setState({
          isScrolling: false
        }, () => {
          // Clear style cache after state update has been committed.
          // This way we don't break pure sCU for items that don't use isScrolling param.
          this._getItemStyleCache(-1, null)
        })
      }
    }

    static getDerivedStateFromProps(nextProps, prevState) {
      validateProps(nextProps, prevState)
      return null
    }

    scrollTo(scrollOffset) {
      scrollOffset = Math.max(0, scrollOffset)
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollOffset) {
          return null
        }

        return {
          scrollDirection: prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset: scrollOffset,
          lockedScrollOffset: scrollOffset,
          scrollUpdateWasRequested: true
        }
      }, this._resetIsScrollingDebounced)
    }

    scrollToItem(index, align = 'auto') {
      const {
        itemCount
      } = this.props
      const {
        scrollOffset
      } = this.state
      index = Math.max(0, Math.min(index, itemCount - 1))
      this.scrollTo(getOffsetForIndexAndAlignment(this.props, this.state.id, index, align, scrollOffset, this))
    }

    componentDidMount() {
      const { initialScrollOffset } = this.props

      if (typeof initialScrollOffset === 'number' && this._outerRef != null) {
        const outerRef = this._outerRef // TODO Deprecate direction "horizontal"

        if (isHorizontalFunc(this.props)) {
          outerRef.scrollLeft = initialScrollOffset
        } else {
          outerRef.scrollTop = initialScrollOffset
        }
      }

      this._callPropsCallbacks()
    }

    // shouldComponentUpdate(nextProps, nextState) {
    //   // if (nextState.isScrolling !== this.state.nextState) {
    //   //   return false;
    //   // }
    //   return true;
    // }

    componentDidUpdate() {
      const {
        scrollOffset,
        scrollUpdateWasRequested
      } = this.state

      if (scrollUpdateWasRequested && this._outerRef != null) {
        const outerRef = this._outerRef // TODO Deprecate direction "horizontal"

        if (isHorizontalFunc(this.props)) {
          if (isRtlFunc(this.props)) {
            // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
            // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
            // So we need to determine which browser behavior we're dealing with, and mimic it.
            switch (getRTLOffsetType()) {
              case 'negative':
                outerRef.scrollLeft = -scrollOffset
                break

              case 'positive-ascending':
                outerRef.scrollLeft = scrollOffset
                break

              default:
                const {
                  clientWidth,
                  scrollWidth
                } = outerRef
                outerRef.scrollLeft = scrollWidth - clientWidth - scrollOffset
                break
            }
          } else {
            outerRef.scrollLeft = scrollOffset
          }
        } else {
          outerRef.scrollTop = scrollOffset
        }
      }

      this._callPropsCallbacks()
    }

    componentWillUnmount() {
      if (this._resetIsScrollingTimeoutId !== null) {
        cancelTimeout(this._resetIsScrollingTimeoutId)
      }
    }

    /**
     * 基于key实现内存复用
     */
    resolveKey(index, itemData) {
      // console.log("渲染开始")
      // console.log(this.recyclerkeys);
      const { isRecycler, itemKey, itemType } = this.props;
      let currentKey = itemKey({ index, item: itemData[index] });
      if (!isRecycler) return currentKey;
      const type = itemType({ index, item: itemData[index] });
      // 可复用keys
      let typeArray = this.recyclerkeys[type] || [];
      /**************** case 1 当前index为新旧dom交集 ****************/
      let typeIndex = typeArray.findIndex((element, i) => {
        return element.index === index;
      })
      if (typeIndex > -1) {
        currentKey = typeArray[typeIndex].key;
        return currentKey;
      }

      /**************** case 2 当前index不为新旧dom交集 ****************/
      typeIndex = typeArray.findIndex((element, i) => {
        return element.index < this.startIndex || element.index > this.stopIndex;
      })
      if (typeIndex > -1) {
        currentKey = typeArray[typeIndex].key;
        typeArray.splice(typeIndex, 1, { key: currentKey, index });
        this.recyclerkeys = {
          ...this.recyclerkeys,
          [type]: typeArray
        };
        return currentKey;
      }

      /**************** case 3 当前index无可复用key ****************/
      typeArray.push({ index, key: currentKey });
      this.recyclerkeys = {
        ...this.recyclerkeys,
        [type]: typeArray
      };
      return currentKey;
    }

    /**
     * 渲染结束之后清楚旧domkey记录
     */
    clearKeys() {
      // console.log("渲染结束")
      // console.log(this.recyclerkeys);
      if (!this.props.isRecycler) return;

      let tempRecyclerkeys = {};
      for (let key in this.recyclerkeys) {
        const typeArray = (this.recyclerkeys[key] || []).filter(item => {
          return item.index >= this.startIndex && item.index <= this.stopIndex;
        })
        tempRecyclerkeys[key] = typeArray;
      }
      this.recyclerkeys = tempRecyclerkeys;
    }

    render() {
      const {
        children,
        className,
        direction,
        height,
        innerRef,
        innerElementType,
        innerTagName,
        itemElementType,
        itemTagName,
        itemCount,
        itemData,
        itemKey = defaultItemKey,
        itemType, // 新增，用于item分类
        layout,
        outerElementType,
        outerTagName,
        style,
        useIsScrolling,
        width,
        position,
        renderBottom,
        renderHeader,
        ...rest
      } = this.props
      const {
        id,
        isScrolling,
        scrollOffset,
        lockedScrollOffset,
        scrollUpdateWasRequested
      } = this.state // TODO Deprecate direction "horizontal"

      const isHorizontal = isHorizontalFunc(this.props)
      const onScroll = isHorizontal ? this._onScrollHorizontal : this._onScrollVertical

      const [startIndex, stopIndex] = this._getRangeToRender()
      this.startIndex = startIndex;
      this.stopIndex = stopIndex;

      const items = []
      if (itemCount > 0) {
        for (let index = startIndex; index <= stopIndex; index++) {
          // 基于key实现内存复用
          const key = this.resolveKey(index, itemData);
          let style
          if (position === 'relative') {
            const size = getItemSize(this.props, index, this)
            style = {
              height: this._getStyleValue(!isHorizontal ? size : '100%'),
              width: this._getStyleValue(isHorizontal ? size : '100%')
            }
          } else {
            style = this._getItemStyle(index)
          }
          items.push(createElement(itemElementType || itemTagName || 'div', {
            key, style
          }, createElement(children, {
            id: `${id}-${index}`,
            data: itemData,
            index,
            isScrolling: useIsScrolling ? isScrolling : undefined
          })))
        }
      }
      // Read this value AFTER items have been created,
      // So their actual sizes (if variable) are taken into consideration.

      const estimatedTotalSize = getEstimatedTotalSize(this.props, this)
      const outerElementProps = {
        ...rest,
        id,
        className,
        onScroll,
        ref: this._outerRefSetter,
        layout,
        style: {
          position: 'relative',
          height: this._getStyleValue(height),
          width: this._getStyleValue(width),
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          willChange: 'transform',
          direction,
          ...style
        },
        startIndex,
        stopIndex,
      }
      if (scrollUpdateWasRequested) {
        if (isHorizontal) {
          outerElementProps.scrollLeft = scrollOffset
        } else {
          outerElementProps.scrollTop = scrollOffset
        }
      } else {
        if (isHorizontal) {
          outerElementProps.scrollLeft = lockedScrollOffset
        } else {
          // outerElementProps.scrollTop = lockedScrollOffset
        }
      }

      // 清楚非展示缓存key
      this.clearKeys();

      if (position === 'relative') {
        const pre = getItemOffset(this.props, startIndex, this)
        return createElement(outerElementType || outerTagName || 'div', outerElementProps,
          createElement(itemElementType || itemTagName || 'div', {
            key: `${id}-pre`,
            id: `${id}-pre`,
            style: {
              height: isHorizontal ? '100%' : this._getStyleValue(pre),
              width: !isHorizontal ? '100%' : this._getStyleValue(pre)
            }
          }),
          createElement(innerElementType || innerTagName || 'div', {
            ref: innerRef,
            key: `${id}-inner`,
            id: `${id}-inner`,
            style: {
              pointerEvents: isScrolling ? 'none' : 'auto'
            }
          }, items),
          renderBottom
        )
      } else {
        return createElement(outerElementType || outerTagName || 'div', outerElementProps,
          renderHeader ? renderHeader() : null,
          createElement(innerElementType || innerTagName || 'div', {
            ref: innerRef,
            key: `${id}-inner`,
            id: `${id}-inner`,
            style: {
              height: this._getStyleValue(isHorizontal ? '100%' : estimatedTotalSize),
              pointerEvents: isScrolling ? 'none' : 'auto',
              width: this._getStyleValue(isHorizontal ? estimatedTotalSize : '100%')
            }
          }, items),
          renderBottom
        )
      }
    }

    _callPropsCallbacks() {
      if (typeof this.props.onItemsRendered === 'function') {
        const {
          itemCount
        } = this.props

        if (itemCount > 0) {
          const [overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex] = this._getRangeToRender()

          this._callOnItemsRendered(overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex)
        }
      }

      if (typeof this.props.onScroll === 'function') {
        const {
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested
        } = this.state

        this._callOnScroll(scrollDirection, scrollOffset, scrollUpdateWasRequested, this.field)
      }
    }
    // Lazily create and cache item styles while scrolling,
    // So that pure component sCU will prevent re-renders.
    // We maintain this cache, and pass a style prop rather than index,
    // So that List can clear cached styles and force item re-render if necessary.

    _getRangeToRender() {
      const {
        itemCount,
        overscanCount
      } = this.props
      const {
        isScrolling,
        scrollDirection,
        scrollOffset
      } = this.state

      if (itemCount === 0) {
        return [0, 0, 0, 0]
      }

      const startIndex = getStartIndexForOffset(this.props, scrollOffset, this)
      const stopIndex = getStopIndexForStartIndex(this.props, scrollOffset, startIndex, this) // Overscan by one item in each direction so that tab/focus works.
      // If there isn't at least one extra item, tab loops back around.

      const overscanBackward = !isScrolling || scrollDirection === 'backward' ? Math.max(1, overscanCount) : 1
      const overscanForward = !isScrolling || scrollDirection === 'forward' ? Math.max(1, overscanCount) : 1
      return [Math.max(0, startIndex - overscanBackward), Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)), startIndex, stopIndex]
    }
  }, _class.defaultProps = {
    direction: 'ltr',
    itemData: undefined,
    layout: 'vertical',
    overscanCount: 2,
    useIsScrolling: false
  }, _temp
}

// NOTE: I considered further wrapping individual items with a pure ListItem component.
// This would avoid ever calling the render function for the same index more than once,
// But it would also add the overhead of a lot of components/fibers.
// I assume people already do this (render function returning a class component),
// So my doing it would just unnecessarily double the wrappers.
