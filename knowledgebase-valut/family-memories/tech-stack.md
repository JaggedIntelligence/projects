# Tech stack for Family Memories

### TOC
-----------------------------------------------------------------
TOC 

 8. Summary of License Upgrade -- SR Note
  - License is upgraded to more easier terms with Commercial use with $20 MM per month limit

3. Steps SR did -----------
2. background of the Repo

1. Use cases

-----------------------------------------------------------------
### 1/ Use cases
- kids trophies , achievements
-1. kids memorable school work :  k - 5,  middle school , high school
-2.  yours and spouse memorable things :  Notes, drawings, writings ... 
- kids school grades 

RECORDs part:
-3.  Health records of:
        Kids, you& spouse, parents
        medical prescriptions
 - 4. big ticket items records:
  - your first new car buy, your home buy, 
  - 5. Insurance, investments,

-----------------------------------------------------------------

### 2. background -----------
- online tool url https://www.modelscope.cn/studios/OpenDataLab/MinerU
- above medical image file got from internet ( saved in  Downloads/lipid-profile file)
- MinrU online tool converted it into Markdown text

-----------------------------------------------------------------

### 3. Steps SR did -----------
- online tool url https://www.modelscope.cn/studios/OpenDataLab/MinerU
- above medical image file got from internet ( saved in  Downloads/lipid-profile file)
- MinrU online tool converted it into Markdown text 

### ------------ converted Markdown text --------------------
```
Name : Mr Dummy

Age/Gender : 20/Male

Referred By : Self

Phone No. :

Patient ID : PN2

Report ID : RE1

Collection Date: 24/06/2023 08:49 PM

Report Date : 24/06/2023 09:02 PM

BIOCHEMISTRY
LIPID PROFILE 

<table><tr><td>TEST DESCRIPTION</td><td>RESULT</td><td>REF. RANGE</td><td>UNIT</td></tr><tr><td>Total Cholesterol</td><td>156</td><td>0 - 200</td><td>mg/dl</td></tr><tr><td>Triglycerides level</td><td>150</td><td>0 - 170</td><td>mg/dl</td></tr><tr><td>HDL Cholesterol</td><td>45</td><td>40 - 70</td><td>mg/dl</td></tr><tr><td>LDL Cholesterol</td><td>81.00</td><td>0 - 100</td><td>mg/dl</td></tr><tr><td>VLDL Cholesterol</td><td>30.00</td><td>6 - 38</td><td>mg/dl</td></tr><tr><td>LDL/HDL RATIO</td><td>1.80</td><td>2.5 - 3.5</td><td></td></tr><tr><td>Total Cholesterol/HDL RATIO</td><td>3.47</td><td>3.5 - 5</td><td></td></tr></table>

Interpretation: 

<table><tr><td>Lipid Profile Test</td><td>Desirable Levels</td><td>Borderline High</td><td>High</td></tr><tr><td>Total cholesterol</td><td>&lt;200 mg/dL</td><td>200-239 mg/dL</td><td>≥240 mg/dL</td></tr><tr><td>LDL cholesterol</td><td>&lt;100 mg/dL</td><td>130-159 mg/dL</td><td>≥160 mg/dL</td></tr><tr><td>HDL cholesterol</td><td>≥60 mg/dL</td><td>40-59 mg/dL</td><td>&lt;40 mg/dL</td></tr><tr><td>Triglycerides</td><td>&lt;150 mg/dL</td><td>150-199 mg/dL</td><td>≥200 mg/dL</td></tr></table>

Desirable levels of cholesterol and triglycerides are associated with a lower risk of heart disease, while high levels increase the risk. HDL cholesterol is often called "good" cholesterol, as it helps to remove excess cholesterol from the blood vessels. In contrast, LDL cholesterol is often called "bad" cholesterol, as it contributes to the buildup of plaque in the arteries.
```

------------------------------------------------------------

### 8. Summary of License Upgrade -- SR Note
  - License is upgraded to more easier terms with Commercial use with $20 MM per month limit
  - see the 2 page urls with Details

https://github.com/opendatalab/MinerU
2026/04/18 3.1.0 Released
This release focuses on licensing openness, parsing accuracy, and full-format native support. The main updates include:

License upgrade
MinerU has officially moved from AGPLv3 to the MinerU Open Source License, a custom license based on Apache 2.0.

This change significantly reduces adoption friction for both community users and commercial deployments, making MinerU easier to integrate into real-world workflows.


https://github.com/opendatalab/MinerU/blob/master/LICENSE.md

1. Commercial License and Thresholds
MinerU may be used for commercial purposes without a separate commercial license. However, if you and your Affiliates, on a consolidated basis, meet either of the following thresholds, you must obtain a separate commercial license from [MinerU Team] before continuing such use:

a. monthly active users (MAU) exceed 100 million; or
b. total monthly revenue exceeds USD 20 million.

2. Online Service Attribution Obligation
If you provide online services to third parties based on MinerU, you must clearly and prominently indicate, in the relevant product or service interface or in publicly available documentation, that MinerU is used.
