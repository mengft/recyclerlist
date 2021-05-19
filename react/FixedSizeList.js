import createListComponent, { isHorizontalFunc } from './createListComponent'

let devWarningsDirection = null
let devWarningsTagName = null

if (process.env.NODE_ENV !== 'production') {
  if (typeof window !== 'undefined' && typeof window.WeakSet !== 'undefined') {
    devWarningsDirection =
      /* #__PURE__ */
      new WeakSet()
    devWarningsTagName =
      /* #__PURE__ */
      new WeakSet()
  }
}

const validateSharedProps = ({
  children,
  direction,
  height,
  layout,
  itemTagName,
  innerTagName,
  outerTagName,
  width
}, {
  instance
}) => {
  if (process.env.NODE_ENV !== 'production') {
    if (innerTagName != null || outerTagName != null || itemTagName != null) {
      if (devWarningsTagName && !devWarningsTagName.has(instance)) {
        devWarningsTagName.add(instance)
        console.warn('The itemTagName、innerTagName and outerTagName props have been deprecated. ' + 'Please use the itemElementType、innerElementType and outerElementType props instead.')
      }
    } // TODO Deprecate direction "horizontal"

    const isHorizontal = direction === 'horizontal' || layout === 'horizontal'

    switch (direction) {
      case 'horizontal':
      case 'vertical':
        if (devWarningsDirection && !devWarningsDirection.has(instance)) {
          devWarningsDirection.add(instance)
          console.warn('The direction prop should be either "ltr" (default) or "rtl". ' + 'Please use the layout prop to specify "vertical" (default) or "horizontal" orientation.')
        }

        break

      case 'ltr':
      case 'rtl':
        // Valid values
        break

      default:
        throw Error('An invalid "direction" prop has been specified. ' + 'Value should be either "ltr" or "rtl". ' + `"${direction}" was specified.`)
    }

    switch (layout) {
      case 'horizontal':
      case 'vertical':
        // Valid values
        break

      default:
        throw Error('An invalid "layout" prop has been specified. ' + 'Value should be either "horizontal" or "vertical". ' + `"${layout}" was specified.`)
    }

    if (children == null) {
      throw Error('An invalid "children" prop has been specified. ' + 'Value should be a React component. ' + `"${children === null ? 'null' : typeof children}" was specified.`)
    }

    if (isHorizontal && typeof width !== 'number') {
      throw Error('An invalid "width" prop has been specified. ' + 'Horizontal lists must specify a number for width. ' + `"${width === null ? 'null' : typeof width}" was specified.`)
    } else if (!isHorizontal && typeof height !== 'number') {
      throw Error('An invalid "height" prop has been specified. ' + 'Vertical lists must specify a number for height. ' + `"${height === null ? 'null' : typeof height}" was specified.`)
    }
  }
}

// mengft
const getItemOffset = (props, index, ref) => {
  if (!props.unlimitedSize) {
    const numColumns = props.numColumns;
    // 列表高度
    let offset = 0;
    const sizeType = props?.itemHeight?.constructor;
    if (sizeType === Function) {
      for (let i = 0; i < index; i++) {
        if (index % numColumns === i % numColumns) {
          offset += props?.itemHeight({ item: props?.itemData?.[i], index: i });
        }
      }
    } else if (sizeType === Number) {
      offset = Math.floor(index / numColumns) * props.itemSize;
    }
    // header高度
    if (props?.layout === 'vertical' && props?.makeHeaderHeight?.constructor === Number) offset += props.makeHeaderHeight
    return offset;
  }
  return ref._getCountSize(props, index)
}

const getItemSize = (props, index, ref) => {
  if (!props.unlimitedSize) {
    const sizeType = props?.itemHeight?.constructor;
    if (sizeType === Function) {
      return props?.itemHeight({ item: props?.itemData?.[index], index });
    } else if (sizeType === Number) {
      return props?.itemHeight;
    }
  }
  return ref._getSizeUpload(index, isHorizontalFunc(props))
};

const FixedSizeList =
  /* #__PURE__ */
  createListComponent({
    // mengft
    getItemOffset,
    // mengft
    getItemLeft(props, index, ref) {
      const numColumns = props.numColumns;
      return (index % numColumns) * (props.width / numColumns);
    },
    // mengft
    getItemWidth(props, index, ref) {
      const numColumns = props.numColumns || 1;
      return props.width / numColumns;
    },
    getItemSize,
    getEstimatedTotalSize(props, ref) {
      return ref._getCountSize(props, props.itemCount, 1);
    },
    getOffsetForIndexAndAlignment: (props, id, index, align, scrollOffset, ref) => {
      const { height, width } = props
      const { sizeList } = ref.state
      // TODO Deprecate direction "horizontal"
      const size = isHorizontalFunc(props) ? width : height
      const itemSize = ref._getSize(sizeList[index])
      const lastItemOffset = Math.max(0, ref._getCountSize(props, props.itemCount) - size)
      const maxOffset = Math.min(lastItemOffset, ref._getCountSize(props, index))
      const minOffset = Math.max(0, ref._getCountSize(props, index) - size + itemSize)

      if (align === 'smart') {
        if (scrollOffset >= minOffset - size && scrollOffset <= maxOffset + size) {
          align = 'auto'
        } else {
          align = 'center'
        }
      }

      switch (align) {
        case 'start':
          return maxOffset

        case 'end':
          return minOffset

        case 'center':
          {
            // "Centered" offset is usually the average of the min and max.
            // But near the edges of the list, this doesn't hold true.
            const middleOffset = Math.round(minOffset + (maxOffset - minOffset) / 2)

            if (middleOffset < Math.ceil(size / 2)) {
              return 0 // near the beginning
            } else if (middleOffset > lastItemOffset + Math.floor(size / 2)) {
              return lastItemOffset // near the end
            } else {
              return middleOffset
            }
          }

        case 'auto':
        default:
          if (scrollOffset >= minOffset && scrollOffset <= maxOffset) {
            return scrollOffset
          } else if (scrollOffset < minOffset) {
            return minOffset
          } else {
            return maxOffset
          }
      }
    },
    getStartIndexForOffset(props, scrollOffset, ref) {
      // mengft
      let tempItemData = [...props?.itemData];
      let findFirstIndex = tempItemData.findIndex((item, index) => {
        const offset = getItemOffset(props, index, ref);
        const size = getItemSize(props, index, ref);
        return offset + size >= scrollOffset;
      })
      if (findFirstIndex === -1) findFirstIndex = 0;
      return findFirstIndex;
    },
    getStopIndexForStartIndex(props, scrollOffset, startIndex, ref) {
      const { itemData, height } = props
      let tempItemData = [...itemData];
      let findFirstIndex = tempItemData.findIndex((item, index) => {
        const offset = getItemOffset(props, index, ref);
        return offset >= (scrollOffset + height);
      })
      if (findFirstIndex === -1) findFirstIndex = itemData?.length - 1;
      return findFirstIndex;
    },

    initInstanceProps() { // Noop
    },

    shouldResetStyleCacheOnItemSizeChange: true,
    validateProps: (nextProps, prevState) => {
      const { itemCount, itemSize } = nextProps
      const { sizeList } = prevState
      if (itemCount > sizeList.length) {
        const arr = new Array(itemCount - sizeList.length).fill(-1)
        sizeList.push(...arr)
      } else if (itemCount < sizeList.length) {
        sizeList.length = itemCount
      }
      if (process.env.NODE_ENV !== 'production') {
        // if (typeof itemSize !== 'number') {
        //   throw Error('An invalid "itemSize" prop has been specified. ' + 'Value should be a number. ' + `"${itemSize === null ? 'null' : typeof itemSize}" was specified.`)
        // }
      }
      validateSharedProps(nextProps, prevState)
    }
  })

export default FixedSizeList
