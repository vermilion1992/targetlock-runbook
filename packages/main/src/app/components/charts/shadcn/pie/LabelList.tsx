import CodePreview from '@/app/components/shared/CodePreview'
import ChartPieLabellist from './code/LabelListCode'

const ChartPieLabelList = () => {
  return (
    <>
      <CodePreview
        component={<ChartPieLabellist />}
        title='Label List'
        filePath='src/app/components/charts/shadcn/pie/code/LabelListCode.tsx'
      />
    </>
  )
}

export default ChartPieLabelList
