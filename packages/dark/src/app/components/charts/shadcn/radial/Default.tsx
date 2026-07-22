import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadialsimple from './code/DefaultCode'

const ChartRadialSimple = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadialsimple />}
        title='Default'
        filePath='src/app/components/charts/shadcn/radial/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartRadialSimple
