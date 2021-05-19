# RecyclerListView

这是一款基于@tarojs/components/virtual-list组件实现的高性能列表组件，除性能优化之外，亦扩展了大量API以尽可能满足大部分应用场景。

`npm install --save recyclerlist`

* **[简介](#简介)**
* **[实现了哪些功能](#实现了哪些功能)**
* **[Demo](#demo)**
* **[Props](#props)**

## 简介
**recyclerlist**在@tarojs/components/virtual-list的基础上改造而来，整体思路为延续其展示可视区域，销毁非可视区域元素的思路，并结合**recyclerlistview**的内存复用机制对其性能进行调优，其中原理下面我会提到。当然做这些工作的前提是**virtual-list**组件对子组件绝对布局的支持。

## 实现了哪些功能

- **多列自定义高度瀑布流**  
	- 瀑布流
	- item高度自定义
- 支持渲染Header
- 新增分页事件监听onEndReached
- **内存复用**  
    原理一句话：将old dom的key赋值给new dom

## Demo

```
// 引用
import RecyclerList from 'recyclerlist';

// props使用
<RecyclerList
  width={width}
  height={height}
  itemData={list}
  itemCount={list.length}
  itemHeight={({ item, index }) => itemHeight({ item, index })}
  itemKey={({item, index}) => itemKey({item, index})}
  itemType={({item, index}) => itemType({item, index})}
  renderHeader={renderHeader}
  makeHeaderHeight={123}
  numColumns={2}
  onEndReached={onEndReached}
>
  {props => renderItem(props)}
</RecyclerList>
```

## Props

| Prop | Required | Params Type | Description |
| --- | --- | --- | --- |
| width | yes | number | 列表窗口宽度 |
| height | yes | numer | 列表窗口高度 |
| itemData | yes | array | 列表数据 |
| itemCount | yes | number | 列表数据长度 |
| itemHeight | yes | (params: { item: object, index: number }) => number \| number | item高度 |
| itemKey | yes | (params: { item: object, index: number }) => any | item唯一标识，内存复用机制关键参数，务必保持唯一性 |
| itemType | yes | (params: { item: object, index: number }) => any | item类型，如1：文字、2：图片、3：视频，内存复用机制关键参数，务必谨慎对待 |
| renderHeader | No | () => JSX.Element | 渲染Header |
| makeHeaderHeight | No | number | renderHeader、makeHeaderHeight务必成对出现 |
| numColumns | Yes | number | 列数，默认值为1 |
| onEndReached | No | () => void | 监听分页事件 |

Note：详细api说明请参考源码。
