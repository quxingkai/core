import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IResizeHandleDelegate } from '../resize/resize';
import { IEventBus } from '@ali/ide-core-common';
import { ResizeEvent } from '../../layout';
import { SplitPanelManager } from './split-panel.service';

export const PanelContext = React.createContext<{
  setSize: (targetSize: number, isLatter: boolean) => void,
  getSize: (isLatter: boolean) => number,
}>({
  setSize: (targetSize: number, isLatter: boolean) => {},
  getSize: (isLatter: boolean) => 0,
});

export const SplitPanel: React.FC<{
  children?: Array<React.ReactElement<{ id: string; minSize?: number; maxSize?: number; flex?: number; slot: string; }>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
  id: string;
  // setAbsoluteSize 时保证相邻节点总宽度不变
  resizeKeep?: boolean;
}> = (({ id, className, children = [], direction = 'left-to-right', resizeKeep = true, ...restProps }) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  const totalFlexNum = children.reduce((accumulator, item) => accumulator + (item.props.flex !== undefined ? item.props.flex : 1), 0);
  const panels: {[panelId: string]: React.ReactElement<any>} = {};
  const elements: React.ReactNodeArray = [];
  const resizeDelegates: IResizeHandleDelegate[] = [];
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const rootRef = React.useRef<HTMLElement>();

  const splitPanelService = useInjectable<SplitPanelManager>(SplitPanelManager).getService(id);
  const refs = splitPanelService.panels;

  // 获取setSize的handle，对于最右端或最底部的视图，取上一个位置的handle
  const setSizeHandle = (index) => {
    return (size: number, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      if (resizeDelegates[targetIndex]) {
        resizeDelegates[targetIndex].setAbsoluteSize(size, isLatter, resizeKeep);
      }
    };
  };

  const getSizeHandle = (index) => {
    return (isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      if (resizeDelegates[targetIndex]) {
        return resizeDelegates[targetIndex].getAbsoluteSize(isLatter);
      }
      return 0;
    };
  };

  children.forEach((element, index) => {
    const panelId = element.props.id;
    panels[panelId] = element;
    if (index !== 0) {
      // FIXME window resize支持
      elements.push(
        <ResizeHandle
          onResize={(prev, next) => {
            const prevLocation = children[index - 1].props.slot;
            const nextLocation = children[index].props.slot;
            if (prevLocation) {
              eventBus.fire(new ResizeEvent({slotLocation: prevLocation, width: prev.clientWidth, height: prev.clientHeight}));
            }
            if (nextLocation) {
              eventBus.fire(new ResizeEvent({slotLocation: nextLocation, width: next.clientWidth, height: next.clientHeight}));
            }
          }}
          findNextElement={(direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction)}
          findPrevElement={(direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction, true)}
          key={`split-handle-${index}`}
          delegate={(delegate) => { resizeDelegates.push(delegate); }} />,
      );
    }
    elements.push(
      <PanelContext.Provider value={{setSize: setSizeHandle(index), getSize: getSizeHandle(index)}}>
        <div
          ref={(ele) => {
            if (ele && refs.indexOf(ele) === -1) {
              refs.push(ele);
            }
          }}
          key={panelId}
          style={{[Layout.getSizeProperty(direction)]: ((element.props.flex !== undefined ? element.props.flex : 1) / totalFlexNum * 100) + '%'}}>
          {element}
        </div>
      </PanelContext.Provider>,
    );
  });

  React.useEffect(() => {
    if (rootRef.current) {
      splitPanelService.rootNode = rootRef.current;
    }
  }, [rootRef.current]);

  return (
    <div ref={(ele) => rootRef.current = ele!} {...restProps} className={clsx(styles['split-panel'])} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {elements}
    </div>
  );
});
