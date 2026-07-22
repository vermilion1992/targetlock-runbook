import CodePreview from '@/app/components/shared/CodePreview'
import ChartPiedefault from './code/DefaultCode'

const ChartPieDefault = () => {
  return (
    <>
      <CodePreview
        component={<ChartPiedefault />}
        title='Default'
        filePath='src/app/components/charts/shadcn/pie/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartPieDefault
