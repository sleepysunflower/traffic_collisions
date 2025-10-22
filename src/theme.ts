import * as echarts from 'echarts/core'

export function registerChartsTheme(){
  echarts.registerTheme('noir', {
    backgroundColor: 'transparent',
    color: ['#D84040','#8E1616','#808080','#B0B0B0','#262626'],
    textStyle: { color: '#EDEDED' },
    tooltip: {
      backgroundColor: '#0F0F0F',
      borderColor: '#262626',
      textStyle: { color:'#EDEDED' }
    },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    axisPointer: { lineStyle:{ color:'#808080' } },
    categoryAxis: {
      axisLine: { lineStyle: { color:'#808080' } },
      axisLabel:{ color:'#808080' },
      splitLine:{ show:true, lineStyle:{ color:'#262626' } }
    },
    valueAxis: {
      axisLine: { lineStyle: { color:'#808080' } },
      axisLabel:{ color:'#808080' },
      splitLine:{ show:true, lineStyle:{ color:'#262626' } }
    },
    legend: {
      textStyle: { color:'#EDEDED' }
    }
  })
}
